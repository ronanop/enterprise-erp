"""Document sequence allocation tests (ADR-REG-04)."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.enums import AstEntityType
from modules.asset.models.document_sequence import AstDocumentSequence
from modules.asset.repository.document_sequence_repository import DocumentSequenceRepository
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def seq_db() -> Session:
    raw = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(raw, "connect")
    def _pragma(dbapi_conn, _record) -> None:  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    engine = raw.execution_options(schema_translate_map={"asset": None})
    AstDocumentSequence.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    finally:
        session.close()
        engine.dispose()


def _ctx(tenant_id, company_id) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id,
        user_id=uuid4(),
        user_type="employee",
        company_id=company_id,
        branch_id=uuid4(),
    )


def test_sequential_codes_unique(seq_db: Session) -> None:
    tenant_id = uuid4()
    company_id = uuid4()
    ctx = _ctx(tenant_id, company_id)
    repo = DocumentSequenceRepository(seq_db)
    codes = [repo.next_code(ctx, AstEntityType.ASSET, company_id) for _ in range(5)]
    assert len(codes) == len(set(codes))
    assert codes[0].endswith("000001")
    assert codes[1].endswith("000002")


def test_concurrent_first_row_create_single_sequence_row(seq_db: Session) -> None:
    """First-row concurrent create is validated on PostgreSQL (see test_postgres_*)."""
    pytest.skip("SQLite threading savepoints unreliable; use TEST_DATABASE_URL PostgreSQL test")


def test_multiple_sessions_distinct_codes(seq_db: Session) -> None:
    """Distinct codes across separate DB sessions sharing one sequence row."""
    tenant_id = uuid4()
    company_id = uuid4()
    ctx = _ctx(tenant_id, company_id)
    DocumentSequenceRepository(seq_db).next_code(ctx, AstEntityType.ASSET, company_id)
    seq_db.commit()

    engine = seq_db.get_bind()
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    codes: list[str] = []

    for _ in range(6):
        session = SessionLocal()
        try:
            c = _ctx(tenant_id, company_id)
            codes.append(
                DocumentSequenceRepository(session).next_code(
                    c, AstEntityType.ASSET, company_id
                )
            )
            session.commit()
        finally:
            session.close()

    assert len(codes) == 6
    assert len(set(codes)) == 6
    rows = list(
        seq_db.scalars(
            select(AstDocumentSequence).where(
                AstDocumentSequence.tenant_id == tenant_id,
                AstDocumentSequence.company_id == company_id,
            )
        ).all()
    )
    assert len(rows) == 1


@pytest.mark.postgres
def test_postgres_concurrent_sequence_allocation() -> None:
    """Run when TEST_DATABASE_URL points at PostgreSQL (CI optional)."""
    import os

    url = os.environ.get("TEST_DATABASE_URL")
    if not url or "postgresql" not in url:
        pytest.skip("TEST_DATABASE_URL PostgreSQL not configured")

    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    AstDocumentSequence.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    tenant_id = uuid4()
    company_id = uuid4()
    codes: list[str] = []

    def worker() -> None:
        session = SessionLocal()
        try:
            ctx = _ctx(tenant_id, company_id)
            codes.append(
                DocumentSequenceRepository(session).next_code(
                    ctx, AstEntityType.ASSET, company_id
                )
            )
            session.commit()
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=10) as pool:
        list(pool.map(lambda _: worker(), range(20)))

    assert len(set(codes)) == 20
    with engine.connect() as conn:
        n = conn.execute(
            text(
                "SELECT COUNT(*) FROM asset.ast_document_sequence "
                "WHERE tenant_id = :t AND company_id = :c"
            ),
            {"t": tenant_id, "c": company_id},
        ).scalar()
    assert n == 1
    engine.dispose()
