# Asset CMP — Release Notes

## FP-ASSET-019 Asset Components

### Added

- Productized component install / update / replace / dispose lifecycle
- Tree (depth 1) and code history APIs
- Dedicated RBAC `asset.component:*`
- Partial unique index for active component codes
- `AssetComponentsWorkspace` UI

### Changed

- Replaced scaffold CRUD that used `asset.asset:*` permissions
- Absolute UK on `(asset_id, component_code)` replaced by partial unique for replace history

### Not included

- Nested components / BOM / inventory reservation
- Workflow or Finance posting for components
