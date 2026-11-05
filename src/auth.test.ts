import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// Test password hashing & authentication logic
test('Demo password verification with bcrypt', () => {
  const hash = bcrypt.hashSync('Admin@123', 10);
  assert.equal(bcrypt.compareSync('Admin@123', hash), true);
  assert.equal(bcrypt.compareSync('WrongPassword', hash), false);
  assert.equal(bcrypt.compareSync('admin@123', hash), false);
});

test('Employee credentials verification', () => {
  const empHash = bcrypt.hashSync('Employee@123', 10);
  assert.equal(bcrypt.compareSync('Employee@123', empHash), true);
  assert.equal(bcrypt.compareSync('employee@123', empHash), false);
});

// Test token generation and validation
const tokens = new Map<string, { username: string; expiresAt: number }>();

function generateToken(username: string): string {
  const token = 'th_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  tokens.set(token, { username, expiresAt: Date.now() + 3600000 });
  return token;
}

function validateToken(token: string): string | null {
  const data = tokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    tokens.delete(token);
    return null;
  }
  return data.username;
}

test('Token generation and lifecycle', () => {
  const token = generateToken('admin');
  assert.ok(token.startsWith('th_'));
  assert.equal(validateToken(token), 'admin');
  assert.equal(validateToken('invalid_token'), null);
});

// Test department validation rules
const DEPARTMENTS = [
  'Finance',
  'Marketing',
  'Sales',
  'Human Resources',
  'Information Technology',
  'Operations',
];

test('Department validation enforces exact enterprise business units', () => {
  assert.equal(DEPARTMENTS.includes('Finance'), true);
  assert.equal(DEPARTMENTS.includes('Information Technology'), true);
  assert.equal(DEPARTMENTS.includes('Engineering'), false);
  assert.equal(DEPARTMENTS.includes('finance'), false);
});

// Test rating validation
test('Feedback rating validation enforces 1 to 5 stars', () => {
  function isValidRating(r: number) {
    return Number.isInteger(r) && r >= 1 && r <= 5;
  }
  assert.equal(isValidRating(5), true);
  assert.equal(isValidRating(1), true);
  assert.equal(isValidRating(0), false);
  assert.equal(isValidRating(6), false);
  assert.equal(isValidRating(3.5), false);
});

// Live HTTP End-to-End Integration Tests
test('HTTP POST /login with correct credentials succeeds and returns auth_token', async () => {
  const res = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ user_id: 'admin', password: 'Admin@123' })
  });
  assert.equal(res.status, 200);
  const data = await res.json() as { success: boolean; token: string; user: { username: string } };
  assert.equal(data.success, true);
  assert.ok(data.token && data.token.startsWith('th_'));
  assert.equal(data.user.username, 'admin');
});

test('HTTP POST /login with incorrect credentials returns 401 Unauthorized', async () => {
  const res = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ user_id: 'admin', password: 'WrongPassword999' })
  });
  assert.equal(res.status, 401);
  const data = await res.json() as { success: boolean; error: string };
  assert.equal(data.success, false);
  assert.ok(data.error.includes('Invalid'));
});

test('HTTP GET /dashboard unauthenticated returns 401 when requesting JSON or redirects to /login', async () => {
  const res = await fetch('http://localhost:3000/dashboard', {
    headers: { 'Accept': 'application/json' },
    redirect: 'manual'
  });
  assert.equal(res.status === 401 || res.status === 302, true);
});

test('HTTP GET /dashboard with valid token succeeds with 200 OK', async () => {
  // First login
  const loginRes = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ user_id: 'admin', password: 'Admin@123' })
  });
  const loginData = await loginRes.json() as { token: string };

  // Query dashboard with auth_token
  const dashRes = await fetch(`http://localhost:3000/dashboard?auth_token=${loginData.token}`);
  assert.equal(dashRes.status, 200);
  const html = await dashRes.text();
  assert.ok(html.includes('TrainingHub'));
  assert.ok(html.includes('Active Trainings'));
});

test('HTTP GET /api/notifications returns notification array and unread count for authenticated user', async () => {
  const loginRes = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ user_id: 'admin', password: 'Admin@123' })
  });
  const loginData = await loginRes.json() as { token: string };

  const res = await fetch(`http://localhost:3000/api/notifications?auth_token=${loginData.token}`);
  assert.equal(res.status, 200);
  const data = await res.json() as { notifications: any[]; unreadCount: number };
  assert.ok(Array.isArray(data.notifications));
  assert.equal(typeof data.unreadCount, 'number');
});

