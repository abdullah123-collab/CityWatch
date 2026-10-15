const http = require('http');
const app = require('../server');
const { getPool } = require('../config/db');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { ...headers };
    let payload;

    if (body) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers: reqHeaders }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first.split(';')[0];
}

async function runTests() {
  console.log('\n=============================================');
  console.log('   CITYWATCH BACKEND INTEGRATION TEST SUITE   ');
  console.log('=============================================\n');

  await getPool();
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Running on ephemeral port ${port}\n`);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // TEST 1: Database diagnostics
  await test('Diagnostic endpoint verifies SQL Server connection', async () => {
    const res = await request('GET', '/api/diagnostics/database');
    if (res.status !== 200 || !res.data.connected) {
      throw new Error(`Expected status 200 with connected=true, got ${res.status}`);
    }
  });

  // TEST 2: Citizen Registration Validation
  await test('Registration rejects weak passwords and invalid email formats', async () => {
    const res = await request('POST', '/api/auth/register', {
      fullName: 'John Doe',
      email: 'not-an-email',
      phone: '1234567890',
      password: '123'
    });
    if (res.status === 201) throw new Error('Expected registration to fail validation');
  });

  // TEST 3: Citizen Successful Registration & Persistence
  let citizenCookie = '';
  const uniqueEmail = `citizen_test_${Date.now()}@example.com`;
  await test('Citizen registration succeeds and persists in SQL Server', async () => {
    const res = await request('POST', '/api/auth/register', {
      fullName: 'Test Citizen',
      email: uniqueEmail,
      phone: '+1-555-0199',
      address: '742 Evergreen Terrace',
      password: 'TestPassword123!'
    });
    if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.data)}`);
    if (!res.data.user || res.data.user.email !== uniqueEmail) throw new Error('User not returned correctly');
    citizenCookie = extractCookie(res.headers);
    if (!citizenCookie) throw new Error('Session cookie not set on registration');
  });

  // TEST 4: Citizen Manual Login
  await test('Citizen manual login succeeds with registered credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: uniqueEmail,
      password: 'TestPassword123!'
    });
    if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
    if (res.data.user.email !== uniqueEmail) throw new Error('Login user mismatch');
  });

  // TEST 5: Rejection of Invalid Login
  await test('Citizen manual login rejects incorrect password', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: uniqueEmail,
      password: 'WrongPassword999!'
    });
    if (res.status !== 401) throw new Error(`Expected status 401, got ${res.status}`);
  });

  // TEST 6: Staff Login
  let staffCookie = '';
  await test('Staff authentication succeeds for municipal staff account', async () => {
    const res = await request('POST', '/api/auth/staff-login', {
      email: 'ahmed.staff@example.com',
      password: 'StaffPass123!'
    });
    if (res.status !== 200) throw new Error(`Staff login failed: ${JSON.stringify(res.data)}`);
    if (res.data.user.role_name !== 'Staff') throw new Error('Role name was not Staff');
    staffCookie = extractCookie(res.headers);
  });

  // TEST 7: Admin Login
  let adminCookie = '';
  await test('Admin authentication succeeds for administrator account', async () => {
    const res = await request('POST', '/api/auth/staff-login', {
      email: 'admin@citywatch.gov',
      password: 'AdminPass123!'
    });
    if (res.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(res.data)}`);
    if (res.data.user.role_name !== 'Admin') throw new Error('Role name was not Admin');
    adminCookie = extractCookie(res.headers);
  });

  // TEST 8: Authorization Barrier - Citizen cannot access Admin API
  await test('Citizen is blocked with 403 when requesting Admin dashboard', async () => {
    const res = await request('GET', '/api/admin/dashboard', null, { Cookie: citizenCookie });
    if (res.status !== 403) throw new Error(`Expected status 403 Forbidden, got ${res.status}`);
  });

  // TEST 9: Authorization Barrier - Staff cannot access Admin API
  await test('Staff is blocked with 403 when requesting Admin dashboard', async () => {
    const res = await request('GET', '/api/admin/dashboard', null, { Cookie: staffCookie });
    if (res.status !== 403) throw new Error(`Expected status 403 Forbidden, got ${res.status}`);
  });

  // TEST 10: Admin Dashboard access
  await test('Admin successfully retrieves system-wide metrics from SQL Server', async () => {
    const res = await request('GET', '/api/admin/dashboard', null, { Cookie: adminCookie });
    if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
    if (typeof res.data.metrics.totalComplaints !== 'number') throw new Error('Metrics missing');
  });

  // TEST 11: Citizen submits complaint
  let createdComplaintId;
  await test('Citizen creates complaint with location coordinates', async () => {
    const res = await request('POST', '/api/complaints', {
      departmentId: 1,
      title: 'Pothole on Main Boulevard',
      description: 'Severe road depression creating hazards for vehicles.',
      category: 'Road Maintenance',
      priority: 'High',
      location: {
        areaName: 'Sector G-9',
        city: 'Capital City',
        district: 'North District',
        pincode: '44000',
        latitude: 33.6844,
        longitude: 73.0479
      }
    }, { Cookie: citizenCookie });

    if (res.status !== 201) throw new Error(`Complaint submission failed: ${JSON.stringify(res.data)}`);
    createdComplaintId = res.data.complaintId;
    if (!createdComplaintId) throw new Error('Missing complaint ID');
  });

  // TEST 12: Citizen views complaint details and history
  await test('Citizen retrieves complaint details with timeline history', async () => {
    const res = await request('GET', `/api/complaints/${createdComplaintId}`, null, { Cookie: citizenCookie });
    if (res.status !== 200) throw new Error(`Failed to get details: ${JSON.stringify(res.data)}`);
    if (res.data.complaint.title !== 'Pothole on Main Boulevard') throw new Error('Title mismatch');
    if (!Array.isArray(res.data.history) || res.data.history.length === 0) throw new Error('Missing history records');
  });

  // TEST 13: Admin assigns complaint to staff
  await test('Admin assigns complaint to authorized staff member', async () => {
    const res = await request('POST', `/api/admin/complaints/${createdComplaintId}/assign`, {
      staffId: 1
    }, { Cookie: adminCookie });
    if (res.status !== 200) throw new Error(`Assignment failed: ${JSON.stringify(res.data)}`);
  });

  // TEST 14: Staff updates complaint status
  await test('Assigned staff updates complaint status to In Progress with remarks', async () => {
    const res = await request('PATCH', `/api/staff/complaints/${createdComplaintId}/status`, {
      status: 'In Progress',
      remarks: 'Field inspection scheduled for today.'
    }, { Cookie: staffCookie });
    if (res.status !== 200) throw new Error(`Status update failed: ${JSON.stringify(res.data)}`);
  });

  // TEST 15: Citizen submits feedback
  await test('Citizen submits rating and feedback on complaint', async () => {
    const res = await request('POST', `/api/complaints/${createdComplaintId}/feedback`, {
      rating: 5,
      comments: 'Fast response and very professional service.'
    }, { Cookie: citizenCookie });
    if (res.status !== 201) throw new Error(`Feedback failed: ${JSON.stringify(res.data)}`);
  });

  console.log('\n---------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('---------------------------------------------\n');

  server.close();
  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 200);
}

runTests().catch(err => {
  console.error('[Test Suite Error]', err);
  if (server) server.close();
  process.exit(1);
});
