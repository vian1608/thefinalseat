import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../src/app.mjs';
import env from '../src/config/env.mjs';
import bookingRepository from '../src/modules/bookings/booking.repository.mjs';

let server;
let baseUrl;
let validToken;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  validToken = jwt.sign({ email: 'admin@thefinalseat.com', role: 'admin' }, env.jwtSecret || 'secret', { expiresIn: '1h' });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Admin Details Loading & Pagination API Verification', async (t) => {
  await t.test('1. GET /api/admin/bookings?page=1&pageSize=10 returns paginated payload', async () => {
    const res = await fetch(`${baseUrl}/api/admin/bookings?page=1&pageSize=10`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 200, 'GET /api/admin/bookings should return 200');
    const json = await res.json();
    assert.strictEqual(json.success, true, 'Response must indicate success: true');
    assert.ok(Array.isArray(json.bookings), 'Response must contain bookings array');
    assert.ok(json.pagination, 'Response must contain pagination metadata');
    assert.strictEqual(json.pagination.pageSize, 10, 'pageSize must be 10');
    assert.ok(json.bookings.length <= 10, 'Page 1 must contain at most 10 bookings');
  });

  await t.test('2. GET /api/admin/bookings?page=2&pageSize=10 returns page 2 pagination payload', async () => {
    const res = await fetch(`${baseUrl}/api/admin/bookings?page=2&pageSize=10`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 200, 'GET /api/admin/bookings should return 200');
    const json = await res.json();
    assert.strictEqual(json.success, true, 'Response must indicate success: true');
    assert.strictEqual(json.pagination.page, 2, 'Page number must be 2');
  });

  await t.test('3. GET /api/admin/bookings/:id with invalid ID returns HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/admin/bookings/nonexistent-booking-id-99999`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(res.status, 404, 'Details endpoint must return 404 for nonexistent booking');
    const json = await res.json();
    assert.strictEqual(json.success, false, 'Response must indicate success: false');
    assert.strictEqual(json.error.code, 'BOOKING_NOT_FOUND', 'Error code must be BOOKING_NOT_FOUND');
  });
});
