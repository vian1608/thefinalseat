import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const app = read('frontend/src/app/App.js');
const index = read('frontend/src/index.js');
const adminLogin = read('frontend/src/features/admin/pages/AdminLoginPage.js');
const boRouter = read('frontend/src/features/backoffice/BackOfficeRouter.js');
const boShell = read('frontend/src/features/backoffice/BackOfficeShell.js');
const authorize = read('backend/src/middleware/authorize.mjs');
const boMiddleware = read('backend/src/modules/backoffice/backoffice.middleware.mjs');
const boRepository = read('backend/src/modules/backoffice/backoffice.repository.mjs');
const boRoutes = read('backend/src/modules/backoffice/backoffice.routes.mjs');
const adminReporting = read('backend/src/modules/backoffice/admin-reporting.routes.mjs');
const rootRoutes = read('backend/src/routes/index.mjs');
const rbacMigration = read('backend/migrations/100_backoffice_rbac_foundation.sql');
const bridgeMigration = read('backend/migrations/102_crm_flight_bridge.sql');
const financeMigration = read('backend/migrations/105_finance_suppliers_payments.sql');

const additiveMigrations = [
  'backend/migrations/100_backoffice_rbac_foundation.sql',
  'backend/migrations/101_backoffice_crm.sql',
  'backend/migrations/102_crm_flight_bridge.sql',
  'backend/migrations/103_trips_and_hotels.sql',
  'backend/migrations/104_backoffice_car_bookings.sql',
  'backend/migrations/105_finance_suppliers_payments.sql'
].map(read).join('\n');

test('back-office expansion preserves the stable flight admin and enforces RBAC', async t => {
  await t.test('legacy admin URLs remain in the original App route table', () => {
    ['/admin/login','/admin/dashboard','/admin/vouchers','/admin/bookings/new','/admin/bookings/:code'].forEach(route => assert.ok(app.includes(`path="${route}"`), `Missing preserved route: ${route}`));
    assert.ok(index.includes("bookings\\/(?:flights|hotels|cars)"), 'Only product-specific new booking paths should be intercepted by the additive back-office router.');
    assert.ok(!index.includes("bookings\\/(?:new)"), 'Existing create-booking route must stay in the stable App router.');
  });

  await t.test('new flight alias reuses the existing booking detail implementation', () => {
    assert.match(boRouter, /path="\/admin\/bookings\/flights\/:code"[\s\S]*?<AdminDashboard \/>/, 'New flight route must reuse AdminDashboard booking detail.');
    assert.doesNotMatch(boRouter, /FlightEditor|NewFlightEditor/, 'Back office must not introduce a duplicate flight editor.');
  });

  await t.test('roles, granular permissions and OWN TEAM ALL scopes are database-backed', () => {
    ['owner','sales_manager','sales_agent','operations_agent','finance_agent'].forEach(role => assert.ok(rbacMigration.includes(`'${role}'`), `Missing role ${role}`));
    ['crm.leads.view','bookings.flights.edit','authorization.send','payments.refund_large','admin.integrations'].forEach(permission => assert.ok(rbacMigration.includes(`'${permission}'`), `Missing permission ${permission}`));
    ['OWN','TEAM','ALL'].forEach(scope => assert.ok(rbacMigration.includes(`'${scope}'`), `Missing data scope ${scope}`));
    assert.match(boMiddleware, /requirePermission/);
    assert.match(boMiddleware, /applyScope/);
    assert.match(authorize, /bookingInScope/, 'Existing flight admin API access by staff must also enforce record scope.');
  });

  await t.test('UUID booking identifiers and confirmation codes are both safely scope-checked', () => {
    assert.match(boRepository, /UUID_RE/);
    assert.match(boRepository, /UUID_RE\.test\(String\(identifier/);
    assert.match(boRepository, /q\.eq\('id', identifier\)/);
    assert.match(boRepository, /q\.eq\('confirmation_code', identifier\)/);
  });

  await t.test('all new database changes are additive and old booking links are nullable', () => {
    assert.doesNotMatch(additiveMigrations, /DROP\s+(TABLE|COLUMN)\b/i, 'Back-office migrations must not drop production tables or columns.');
    assert.match(bridgeMigration, /ADD COLUMN IF NOT EXISTS lead_id UUID NULL/);
    assert.match(bridgeMigration, /ADD COLUMN IF NOT EXISTS assigned_agent_id UUID NULL/);
    assert.match(bridgeMigration, /ADD COLUMN IF NOT EXISTS trip_id UUID NULL/);
  });

  await t.test('staff share the existing login but do not land on the legacy owner dashboard', () => {
    assert.match(adminLogin, /isStaffProfile/);
    assert.match(adminLogin, /navigate\(isStaffProfile \? '\/admin\/backoffice' : '\/admin\/dashboard'\)/);
    assert.match(index, /pathname\.startsWith\('\/admin\/backoffice'\)/);
  });

  await t.test('backend independently protects sensitive settings and team administration', () => {
    assert.match(boRoutes, /requirePermission\('team\.view'\)/);
    assert.match(boRoutes, /requirePermission\('admin\.settings'\)/);
    assert.match(boRoutes, /requirePermission\('admin\.integrations'\)/);
    assert.match(adminReporting, /requirePermission\('reports\.view'\)/);
    assert.match(adminReporting, /requirePermission\('finance\.view'\)/);
    assert.match(rootRoutes, /router\.use\('\/admin\/backoffice'/);
  });

  await t.test('supplier and finance schema does not store credentials or raw payment-card secrets', () => {
    assert.match(financeMigration, /CREATE TABLE IF NOT EXISTS suppliers/);
    assert.match(financeMigration, /CREATE TABLE IF NOT EXISTS finance_entries/);
    assert.match(financeMigration, /CREATE TABLE IF NOT EXISTS supplier_payments/);
    assert.doesNotMatch(financeMigration, /api_key|password|secret|card_number|cvv/i);
  });

  await t.test('public car routes remain mounted separately from internal car operations', () => {
    assert.match(rootRoutes, /router\.use\('\/cars', carRoutes\)/);
    assert.match(rootRoutes, /router\.use\('\/admin\/backoffice', backofficeRoutes\)/);
  });

  assert.match(boShell, /permissions/);
});
