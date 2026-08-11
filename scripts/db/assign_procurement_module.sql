-- Assign procurement module + BUYER role to an Entra user.
-- Replace :user_email before running.

-- 1) Find user
SELECT id, email, display_name FROM foundation.sec_user
WHERE email = 'your-entra-email@company.com';

-- 2) Assign module (use tenant_id from sec_user row)
-- INSERT INTO foundation.sec_user_module (id, user_id, module_key, tenant_id, created_at, version)
-- VALUES (gen_random_uuid(), '<USER_ID>', 'procurement', '<TENANT_ID>', now(), 1)
-- ON CONFLICT DO NOTHING;

-- 3) Assign BUYER role
SELECT id, role_code FROM foundation.sec_role WHERE role_code IN ('BUYER', 'PROCUREMENT_MANAGER');

-- INSERT INTO foundation.sec_user_role (user_id, role_id, tenant_id, created_at, version)
-- VALUES ('<USER_ID>', '<BUYER_ROLE_ID>', '<TENANT_ID>', now(), 1)
-- ON CONFLICT DO NOTHING;
