# Enterprise ERP API

FastAPI backend for the Enterprise ERP Platform.

## Requirements

- Python 3.13+
- Docker (for infrastructure services)

## Setup

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
cp ../../.env.example ../../.env
```

## Run

```bash
# From apps/api — watch only src/ so editing scripts/ does not crash reload
uvicorn main:app --reload --reload-dir src --host 0.0.0.0 --port 8000 --app-dir src
```

On Windows you can also use:

```powershell
.\scripts\run_dev.ps1
```

## Migrations

```bash
alembic upgrade head
```

## Quality

```bash
ruff check src
ruff format src
mypy src
pytest
```
