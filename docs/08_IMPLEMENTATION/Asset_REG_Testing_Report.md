# Asset Registration — Testing Report

## Suites

| Suite | Path | Count |
|-------|------|------:|
| Unit | `tests/unit/asset/` | 12 |
| Security | `tests/security/asset/` | 4 |
| Integration | `tests/integration/asset/` | 3 |

## Command

```bash
cd apps/api
python -m pytest src/tests/unit/asset src/tests/security/asset src/tests/integration/asset -q
```

## Gaps (accepted)

- No HTTP router E2E tests
- Sequence concurrency not tested on PostgreSQL in CI
- Procurement prefill not integration-tested against real `proc_*` tables
