"""Unit tests for HRMS shift window matching used by Service roster visibility."""

from datetime import time

from modules.hr.service.roster_duty_service import shift_covers_local_time


def test_day_shift_covers_midday():
    assert shift_covers_local_time(time(9, 0), time(18, 0), is_overnight=False, local_time=time(12, 0))
    assert not shift_covers_local_time(time(9, 0), time(18, 0), is_overnight=False, local_time=time(20, 0))


def test_overnight_shift_covers_late_and_early():
    assert shift_covers_local_time(time(22, 0), time(6, 0), is_overnight=True, local_time=time(23, 30))
    assert shift_covers_local_time(time(22, 0), time(6, 0), is_overnight=True, local_time=time(3, 0))
    assert not shift_covers_local_time(time(22, 0), time(6, 0), is_overnight=True, local_time=time(12, 0))


def test_start_after_end_implies_overnight():
    assert shift_covers_local_time(time(20, 0), time(5, 0), is_overnight=False, local_time=time(1, 0))
