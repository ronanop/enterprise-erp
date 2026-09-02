# Asset file storage — deployment notes

Local disk (`ASSET_STORAGE_BACKEND=local`) is the only backend in this phase. DC challan documents are stored under opaque keys such as `dc-challan/{challan_id}/scm-issued/{uuid}.pdf`. The database stores that **key**, never an absolute filesystem path.

## Persistent volume

Set `ASSET_STORAGE_PATH` to an **absolute** directory that is a persistent volume (or bind mount), not the container writable layer.

Example: `/var/erp/asset-storage`

The API process must be able to create that directory and write files into it. On startup the API writes and deletes a probe file; failure is logged as `ERROR` and does not crash the process, but uploads will fail until the path is writable.

This repo’s `docker-compose.yml` does **not** run the API service (only Postgres, Redis, RabbitMQ, MinIO, OpenSearch). When you containerise the API, add a named volume, for example:

```yaml
services:
  api:
    volumes:
      - asset_storage:/var/erp/asset-storage
    environment:
      ASSET_STORAGE_BACKEND: local
      ASSET_STORAGE_PATH: /var/erp/asset-storage

volumes:
  asset_storage:
```

## Single-replica constraint

While the local backend is in use, run **one** API replica that can see that volume. A second replica on a different disk will 404 when serving files written by the first.

## Backup

Back up `ASSET_STORAGE_PATH` together with Postgres. Soft-deleted DC challan rows keep their files; restoring the database without the files (or vice versa) leaves preview/download broken.

## Switching to S3 / MinIO later

Do **not** put cloud credentials in the asset module until a backend exists.

1. Implement `modules/asset/storage/s3.py` with the same `StorageBackend` protocol (`save`, `open`, `delete`, `exists`). Keys stay opaque (`dc-challan/...`).
2. Copy existing objects from the local tree into the bucket using the same keys.
3. Set `ASSET_STORAGE_BACKEND=s3` (and bucket/region env vars on that backend) and restart.
4. Keep the content endpoint authenticated; do not expose the bucket publicly.
