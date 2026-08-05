"""Ensure crm.crm_ovf.scm_on_hold exists."""

from pathlib import Path

from sqlalchemy import create_engine, text


def load_database_url() -> str:
    for candidate in (
        Path(".env"),
        Path("../../.env"),
        Path("../../../.env"),
        Path(__file__).resolve().parents[3] / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ):
        if not candidate.exists():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip("\"'")
    # Local docker-compose default (host port 5433).
    return "postgresql+psycopg://erp:erp_dev_password@localhost:5433/erp"


def main() -> None:
    url = load_database_url()
    print("using", url.split("@")[-1])
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE crm.crm_ovf
                  ADD COLUMN IF NOT EXISTS scm_on_hold BOOLEAN NOT NULL DEFAULT false
                """
            )
        )
        print("scm_on_hold ready")


if __name__ == "__main__":
    main()
