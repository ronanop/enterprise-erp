from uuid import UUID
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.service.compoff_bio_service import BiometricDeviceService

engine = create_engine(
    "postgresql+psycopg://erp-postgres:erp-postgres@127.0.0.1:5433/erp_hrms"
)
db = sessionmaker(bind=engine)()
ctx = TenantContext(
    tenant_id=UUID("860b11e8-e664-44ad-8996-52b399cf7d47"),
    user_id=UUID("0d6307de-dbb2-4d24-ad06-d96a53988862"),
    user_type="platform_admin",
    company_id=UUID("b8b92e3e-6215-47ef-b9a5-4c4e482122bc"),
    all_companies=True,
    admin_module_keys=frozenset({"hr"}),
)
svc = BiometricDeviceService(db)
for did in [
    "30f112f6-3c23-45c1-8a05-073a4f9b339d",
    "7279b2a5-ac00-4def-bb7d-0be688abc228",
]:
    t0 = time.time()
    feed = svc.live_feed(ctx, UUID(did), days=14)
    print(
        did[:8],
        "elapsed",
        round(time.time() - t0, 2),
        "reachable",
        feed.reachable,
        "punches",
        len(feed.punches),
        "today",
        feed.today_punch_count,
    )
