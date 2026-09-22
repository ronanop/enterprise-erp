"""Manufacturing Celery tasks."""

from workers.celery_app import celery_app


@celery_app.task(name="manufacturing.machine_breakdown_alerts")
def machine_breakdown_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.manufacturing.models.machine import MfgMachine

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(MfgMachine).where(
                    MfgMachine.is_deleted.is_(False),
                    MfgMachine.status == "breakdown",
                )
            ).all()
        )
        return {"status": "ok", "breakdowns": len(rows)}
    finally:
        db.close()


@celery_app.task(name="manufacturing.capacity_overload_alerts")
def capacity_overload_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.manufacturing.models.work_center import MfgWorkCenter

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(MfgWorkCenter).where(
                    MfgWorkCenter.is_deleted.is_(False),
                    MfgWorkCenter.status == "active",
                )
            ).all()
        )
        # Placeholder utilization check - open ops vs capacity computed in later sprints
        return {"status": "ok", "work_centers": len(rows), "overloads": 0}
    finally:
        db.close()


@celery_app.task(name="manufacturing.wip_reconcile")
def wip_reconcile() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.manufacturing.models.wip import MfgWip

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(MfgWip).where(
                    MfgWip.is_deleted.is_(False),
                    MfgWip.status == "open",
                )
            ).all()
        )
        mismatches = 0
        for wip in rows:
            expected = float(wip.material_cost or 0) + float(wip.labor_cost or 0) + float(
                wip.overhead_cost or 0
            )
            if abs(expected - float(wip.total_cost or 0)) > 0.0001:
                mismatches += 1
        return {"status": "ok", "open_wip": len(rows), "mismatches": mismatches}
    finally:
        db.close()


@celery_app.task(name="manufacturing.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.manufacturing.models.scrap import MfgScrap

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(MfgScrap).where(
                    MfgScrap.is_deleted.is_(False),
                    MfgScrap.status == "approved",
                    MfgScrap.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "pending_scrap_posts": len(rows)}
    finally:
        db.close()


@celery_app.task(name="manufacturing.scrap_threshold_alerts")
def scrap_threshold_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.manufacturing.models.production_order import MfgProductionOrder

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(MfgProductionOrder).where(
                    MfgProductionOrder.is_deleted.is_(False),
                    MfgProductionOrder.status.in_(["in_progress", "completed"]),
                )
            ).all()
        )
        alerts = 0
        for order in rows:
            planned = float(order.planned_qty or 0)
            scrapped = float(order.scrapped_qty or 0)
            if planned > 0 and (scrapped / planned) >= 0.05:
                alerts += 1
        return {"status": "ok", "alerts": alerts}
    finally:
        db.close()
