"""Shared helpers for model-driven Alembic migrations."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.engine import Connection
from sqlalchemy.sql.schema import Column, Table as SATable


def table_exists(bind: Connection, table_name: str, schema: str | None = None) -> bool:
    return inspect(bind).has_table(table_name, schema=schema)


def column_exists(
    bind: Connection, table_name: str, column_name: str, schema: str | None = None
) -> bool:
    if not table_exists(bind, table_name, schema=schema):
        return False
    return any(
        col["name"] == column_name
        for col in inspect(bind).get_columns(table_name, schema=schema)
    )


def fk_exists(
    bind: Connection, table_name: str, fk_name: str, schema: str | None = None
) -> bool:
    if not table_exists(bind, table_name, schema=schema):
        return False
    return any(
        fk.get("name") == fk_name
        for fk in inspect(bind).get_foreign_keys(table_name, schema=schema)
    )


def fk_exists_on_columns(
    bind: Connection,
    table_name: str,
    local_cols: list[str],
    schema: str | None = None,
) -> bool:
    if not table_exists(bind, table_name, schema=schema):
        return False
    wanted = list(local_cols)
    return any(
        list(fk.get("constrained_columns") or []) == wanted
        for fk in inspect(bind).get_foreign_keys(table_name, schema=schema)
    )


def index_exists(
    bind: Connection, table_name: str, index_name: str, schema: str | None = None
) -> bool:
    if not table_exists(bind, table_name, schema=schema):
        return False
    return any(
        idx.get("name") == index_name
        for idx in inspect(bind).get_indexes(table_name, schema=schema)
    )


def add_column_if_missing(
    table_name: str, column: Column, schema: str | None = None
) -> None:
    from alembic import op

    bind = op.get_bind()
    if column_exists(bind, table_name, column.name, schema=schema):
        return
    op.add_column(table_name, column, schema=schema)


def create_fk_if_missing(
    fk_name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
    *,
    source_schema: str | None = None,
    referent_schema: str | None = None,
    ondelete: str | None = None,
) -> None:
    from alembic import op

    bind = op.get_bind()
    if fk_exists(bind, source_table, fk_name, schema=source_schema):
        return
    if fk_exists_on_columns(bind, source_table, local_cols, schema=source_schema):
        return
    op.create_foreign_key(
        fk_name,
        source_table,
        referent_table,
        local_cols,
        remote_cols,
        source_schema=source_schema,
        referent_schema=referent_schema,
        ondelete=ondelete,
    )


def create_index_if_missing(
    index_name: str,
    table_name: str,
    columns: list[str],
    *,
    schema: str | None = None,
    unique: bool = False,
) -> None:
    from alembic import op

    bind = op.get_bind()
    if index_exists(bind, table_name, index_name, schema=schema):
        return
    op.create_index(
        index_name,
        table_name,
        columns,
        unique=unique,
        schema=schema,
    )


def create_orm_table(table: SATable, bind: Connection) -> None:
    table.create(bind=bind, checkfirst=True)


def create_orm_table_defer_columns(
    table: SATable,
    bind: Connection,
    defer_columns: set[str],
) -> None:
    """Create ORM table omitting columns (and related FKs/indexes) added in later revisions."""
    if table_exists(bind, table.name, schema=table.schema):
        return

    removed_cols: list[Column] = []
    dropped_indexes: list[sa.Index] = []
    dropped_constraints: list[sa.Constraint] = []

    for col_name in defer_columns:
        if col_name not in table.c:
            continue
        col = table.c[col_name]
        for idx in list(table.indexes):
            if col_name in {c.name for c in idx.columns}:
                table.indexes.discard(idx)
                if idx not in dropped_indexes:
                    dropped_indexes.append(idx)
        for constraint in list(table.constraints):
            if isinstance(constraint, sa.ForeignKeyConstraint) and col_name in {
                c.name for c in constraint.columns
            }:
                table.constraints.discard(constraint)
                dropped_constraints.append(constraint)
        for fk in list(col.foreign_keys):
            table.foreign_keys.discard(fk)
        table._columns.remove(col)
        removed_cols.append(col)

    for constraint in list(table.constraints):
        if isinstance(constraint, sa.CheckConstraint):
            sqltext = str(constraint.sqltext)
            if any(name in sqltext for name in defer_columns):
                table.constraints.discard(constraint)
                dropped_constraints.append(constraint)

    try:
        table.create(bind=bind, checkfirst=True)
    finally:
        for col in removed_cols:
            table._columns.add(col)
        for idx in dropped_indexes:
            table.indexes.add(idx)
        for constraint in dropped_constraints:
            table.constraints.add(constraint)
