import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

console.log('========================================================================');
console.log('  AUTOMATED PRE-PRODUCTION SAFETY & RELIABILITY CHECKS');
console.log('========================================================================\n');

async function runSafetyChecks() {
  let failures = [];

  // Check 1: Scan admin.routes.mjs for duplicate METHOD + PATH pairs
  console.log('--- CHECK 1: Route Duplicate Scan ---');
  const adminRoutesPath = path.join(projectRoot, 'backend/src/modules/admin/admin.routes.mjs');
  const adminRoutesContent = await fs.readFile(adminRoutesPath, 'utf8');
  
  const routeRegex = /router\.(get|post|put|patch|delete)\(['"](.*?)['"]/g;
  const routeMap = new Map();
  let match;
  while ((match = routeRegex.exec(adminRoutesContent)) !== null) {
    const key = `${match[1].toUpperCase()} ${match[2]}`;
    if (routeMap.has(key)) {
      failures.push(`Duplicate admin route definition: ${key}`);
    } else {
      routeMap.set(key, true);
    }
  }
  if (failures.filter(f => f.includes('Duplicate admin route')).length === 0) {
    console.log('✓ Check 1 Passed: No duplicate admin routes found.\n');
  } else {
    console.log(`⚠️ Check 1 Failed: Found duplicate routes (to be fixed in Commit 3).\n`);
  }

  // Check 2: Dev Token & Auth Bypasses in Production
  console.log('--- CHECK 2: Dev Token Bypass & Fallback Credential Safety ---');
  const authMiddlewarePath = path.join(projectRoot, 'backend/src/middleware/authenticate.mjs');
  const authContent = await fs.readFile(authMiddlewarePath, 'utf8');

  const envConfigPath = path.join(projectRoot, 'backend/src/config/env.mjs');
  const envContent = await fs.readFile(envConfigPath, 'utf8');

  const adminServicePath = path.join(projectRoot, 'backend/src/modules/admin/admin.service.mjs');
  const adminServiceContent = await fs.readFile(adminServicePath, 'utf8');

  // Verify auth middleware does not contain ungated dev_admin_token in production
  if (authContent.includes("'dev_admin_token'") || authContent.includes("'mock_admin_token_dev'")) {
    if (!authContent.includes("nodeEnv !== 'production'")) {
      failures.push('P0: authenticate.mjs contains dev_admin_token bypass without NODE_ENV protection');
    }
  }

  if (envContent.includes("'your-secret-key-change-this-in-production'")) {
    if (!envContent.includes("throw new Error") && !envContent.includes("NODE_ENV === 'production'")) {
      failures.push('P0: env.mjs contains unvalidated jwtSecret default fallback');
    }
  }

  if (adminServiceContent.includes("// Development / Localhost override: Always permit login")) {
    failures.push('P0: admin.service.mjs contains passwordless login bypass');
  }

  // Check 3: Undeclared identifiers check (e.g. currencyStr in passenger-authorization.service.mjs)
  console.log('--- CHECK 3: Undeclared Identifiers in Critical Services ---');
  const passAuthPath = path.join(projectRoot, 'backend/src/modules/authorizations/passenger-authorization.service.mjs');
  const passAuthContent = await fs.readFile(passAuthPath, 'utf8');
  
  if (passAuthContent.includes('currencyStr')) {
    const hasDeclaration = /const\s+currencyStr\s*=|let\s+currencyStr\s*=|var\s+currencyStr\s*=/.test(passAuthContent);
    if (!hasDeclaration) {
      failures.push('P1: passenger-authorization.service.mjs references currencyStr without variable declaration');
    }
  }

  // Check 4: Resend fetch timeout check
  console.log('--- CHECK 4: External HTTP Fetch Server-Side Timeout ---');
  const resendServicePath = path.join(projectRoot, 'backend/src/integrations/resend/resend.service.mjs');
  const resendContent = await fs.readFile(resendServicePath, 'utf8');

  const fetchCallsWithoutTimeout = (resendContent.match(/fetch\(['"]https:\/\/api\.resend\.com/g) || []).length;
  const timeoutSignals = (resendContent.match(/AbortSignal\.timeout/g) || []).length;

  if (fetchCallsWithoutTimeout > timeoutSignals) {
    failures.push('P1: resend.service.mjs contains HTTP fetch call without server-side AbortSignal.timeout');
  }

  // Check 5: Production test DB mutation safety check
  console.log('--- CHECK 5: Production Acceptance Test Safety Guard ---');
  const acceptanceTestPath = path.join(projectRoot, 'backend/tests/final_production_acceptance_verification.test.mjs');
  const acceptanceContent = await fs.readFile(acceptanceTestPath, 'utf8');

  if (!acceptanceContent.includes("process.env.NODE_ENV === 'production'") || (!acceptanceContent.includes("process.exit(1)") && !acceptanceContent.includes("throw"))) {
    failures.push('P0: final_production_acceptance_verification.test.mjs lacks NODE_ENV production write block guard');
  }

  console.log('========================================================================');
  console.log(`SUMMARY: ${failures.length} active defects identified by safety scan.`);
  console.log('========================================================================');

  failures.forEach((f, idx) => console.log(`${idx + 1}. ❌ ${f}`));

  return failures;
}

runSafetyChecks().catch(err => {
  console.error('Check script error:', err);
  process.exit(1);
});
