-- DevLens 测试数据迁移：tenant-default → tenant-test
-- 2026-08-02
BEGIN;

-- 1. 创建独立测试租户
INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
SELECT 'tenant-test', 'DevLens 测试组织', 'test', 'active',
       now()::text, now()::text
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 'tenant-test');

-- 2. 把本地管理员挂进测试租户（owner）
INSERT INTO tenant_memberships (id, tenant_id, user_id, role, created_at, updated_at)
SELECT 'tmem-test-owner', 'tenant-test', 'usr-local-admin', 'owner',
       now()::text, now()::text
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_memberships WHERE tenant_id = 'tenant-test' AND user_id = 'usr-local-admin'
);

-- 3. 16 张业务表数据迁移（子表通过 project_id 跟随，无需动）
UPDATE projects SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE repositories SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE developers SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE teams SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE team_spaces SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE team_groups SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE large_teams SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE skills SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE skill_sources SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE skill_groups SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE capability_roles SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE capability_gaps SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE identity_matches SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE developer_evaluations SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE project_assessment_snapshots SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';
UPDATE report_exports SET tenant_id = 'tenant-test' WHERE tenant_id = 'tenant-default';

COMMIT;
