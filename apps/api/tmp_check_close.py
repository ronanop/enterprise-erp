from sqlalchemy import create_engine, text
e = create_engine("postgresql+psycopg://erp:erp_dev_password@localhost:5433/erp")
with e.connect() as c:
    r = c.execute(text("select document_number, status from service.svc_service_request where id = '3bf56f73-0468-46c3-81ed-793c2440f256'")).fetchone()
    print("ticket", r)
    perms = c.execute(text("""
      select u.email, p.permission_code
      from foundation.sec_user u
      join foundation.sec_user_role ur on ur.user_id = u.id and ur.is_deleted = false
      join foundation.sec_role_permission rp on rp.role_id = ur.role_id and rp.is_deleted = false
      join foundation.sec_permission p on p.id = rp.permission_id and p.is_deleted = false
      where lower(u.email) like 'admin%' and p.permission_code like 'service%'
      order by 1,2
    """)).fetchall()
    print("admin service perms:")
    for row in perms:
        print(" ", row)
