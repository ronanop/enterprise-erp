# ESS PWA — Phase 3 (Attendance trust + WFH)

## Delivered

### OT / late / calendar
- `EssAttendanceResponse` includes `late_minutes`, `overtime_minutes`, `early_leave_minutes`.
- `GET /ess/attendance/summary?month=YYYY-MM` — present, late, OT minutes, WFH days.
- PWA attendance month calendar uses `attendance_status` colors; OT/late cards use summary API.

### Selfie + face at punch
- `GET /ess/attendance/punch-policy` — `selfie_required`, `face_at_punch_required`, `face_enrolled`, `geofence_required` (from `hr_attendance_rule.ess_*` flags).
- `POST /ess/attendance/punch` accepts optional `image_base64`; stores `check_in_selfie_hash` / `check_out_selfie_hash`.
- Face match uses enrolled profile fingerprint when face is required.
- PWA punch sheet with `FaceCapture` when policy requires camera.

### WFH
- Table `hr_wfh_request` + `WfhRequestService`.
- `GET/POST /ess/wfh-requests`; manager `POST /ess/team-wfh/{id}/manager-approve|reject`.
- Approved WFH skips geofence; punch `source=web`, status `work_from_home`.
- PWA `/attendance/wfh`; approvals hub includes WFH.

## Migration

```bash
cd apps/api
alembic upgrade head   # 0469_ess_phase3_attendance
```

Enable flags on the active attendance rule in HRMS (or SQL):

- `ess_selfie_required`
- `ess_face_at_punch_required`

## Not in Phase 3

- FCM push (Phase 4)
- Storing full selfie images (only fingerprint hashes on attendance rows)
