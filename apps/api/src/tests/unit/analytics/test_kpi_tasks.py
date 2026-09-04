from modules.analytics import tasks


def test_kpi_daily_snapshot_task_name():
    assert tasks.kpi_daily_snapshot.name == "analytics.kpi_daily_snapshot"


def test_kpi_daily_snapshot_on_beat_schedule():
    from workers.celery_app import celery_app

    names = {entry["task"] for entry in celery_app.conf.beat_schedule.values()}
    assert "analytics.kpi_daily_snapshot" in names
