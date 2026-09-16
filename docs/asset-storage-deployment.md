# Asset / object file storage - deployment notes

## AWS S3 (preferred)

Set:

```bash
OBJECT_STORAGE_BACKEND=s3
ASSET_STORAGE_BACKEND=s3
S3_BUCKET=your-bucket
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Credentials may be omitted when the API runs with an IAM role that can
`s3:GetObject` / `PutObject` / `DeleteObject` / `ListBucket` / `HeadBucket`
on that bucket.

Opaque keys stay the same shape as local disk (e.g.
`dc-challan/{challan_id}/scm-issued/{uuid}.pdf`). CRM attachments store full
`s3://bucket/crm/attachments/...` URIs in `crm_attachment.file_path`.

Keep content endpoints authenticated; do not expose the bucket publicly.

### Migrate existing local files

With volumes mounted and S3 configured:

```bash
cd apps/api
PYTHONPATH=src python scripts/migrate_local_storage_to_s3.py --dry-run
PYTHONPATH=src python scripts/migrate_local_storage_to_s3.py
```

Then restart API/Celery. Local Docker volumes can be removed after verifying
downloads.

## Local disk (dev fallback)

```bash
OBJECT_STORAGE_BACKEND=local
ASSET_STORAGE_BACKEND=local
ASSET_STORAGE_PATH=/var/erp/asset-storage
```

While local is in use, run **one** API replica that can see that volume.

## Backup

With S3, enable bucket versioning / cross-region replication as needed and
keep Postgres backups separate. Soft-deleted rows may keep object keys;
restoring the DB without the objects (or vice versa) leaves downloads broken.
