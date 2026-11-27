"""Project code allocation must consider soft-deleted rows (unique is not partial)."""

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from modules.project.domain.enums import PrjEntityType
from modules.project.repository.code_sequence_repository import CodeSequenceRepository


class _FakeScalars:
    def __init__(self, values):
        self._values = values

    def all(self):
        return list(self._values)


class _FakeDb:
    def __init__(self, values):
        self._values = values

    def scalars(self, _stmt):
        return _FakeScalars(self._values)


def test_next_code_advances_past_soft_deleted_codes(monkeypatch):
    year = datetime.now(timezone.utc).year
    company_id = uuid4()
    # Active max is 5; soft-deleted 6–12 still occupy uk_prj_project_company_code.
    codes = [f"PRJ-{year}-{n:06d}" for n in (1, 2, 3, 4, 5, 6, 7, 12)]
    repo = CodeSequenceRepository(_FakeDb(codes))

    model = SimpleNamespace(
        company_id=SimpleNamespace(),
        project_code=SimpleNamespace(),
        is_deleted=SimpleNamespace(),
    )
    # CodeSequenceRepository only uses model attributes in the SQL expression;
    # our fake db ignores the statement and returns the seeded codes.
    got = repo.next_code(PrjEntityType.PROJECT, company_id, model, "project_code")
    assert got == f"PRJ-{year}-000013"


def test_next_code_parses_tombstone_suffix(monkeypatch):
    year = datetime.now(timezone.utc).year
    company_id = uuid4()
    codes = [f"PRJ-{year}-000081~ec3354", f"PRJ-{year}-000005"]
    repo = CodeSequenceRepository(_FakeDb(codes))
    model = SimpleNamespace(
        company_id=SimpleNamespace(),
        project_code=SimpleNamespace(),
        is_deleted=SimpleNamespace(),
    )
    got = repo.next_code(PrjEntityType.PROJECT, company_id, model, "project_code")
    assert got == f"PRJ-{year}-000082"
