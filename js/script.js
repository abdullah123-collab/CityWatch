async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The API request failed.');
  return body;
}

function currentCitizen() {
  const citizen = sessionStorage.getItem('citywatch_citizen');
  return citizen ? JSON.parse(citizen) : null;
}

function requireCitizen() {
  const citizen = currentCitizen();
  if (!citizen) {
    window.location.href = 'login.html';
    throw new Error('A citizen email is required.');
  }
  return citizen;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

// Create status badge element (returns HTML string)
function statusBadge(status){
  const cls = status === 'Resolved' ? 'green' : status === 'In Progress' ? 'orange' : 'red';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

async function loadComplaints(filters = {}) {
  const params = new URLSearchParams({ citizenId: requireCitizen().citizen_id });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return api(`/api/complaints?${params}`);
}

function complaintRow(complaint) {
  return `
    <tr>
      <td>${complaint.complaint_id}</td>
      <td>${escapeHtml(complaint.title)}</td>
      <td>${escapeHtml(complaint.department)}</td>
      <td>${escapeHtml(complaint.priority)}</td>
      <td>${statusBadge(complaint.status)}</td>
      <td>${formatDate(complaint.submitted_at)}</td>
      <td><a href="details.html?id=${complaint.complaint_id}">View</a></td>
    </tr>`;
}

// Render recent complaints in dashboard table (top 5)
async function renderRecent(){
  const tbl = document.querySelector('#recentTable tbody');
  if(!tbl) return;
  const data = await loadComplaints();
  tbl.innerHTML = data.length
    ? data.slice(0, 5).map(complaintRow).join('')
    : '<tr><td colspan="7">No complaints submitted yet.</td></tr>';
}

// Render full history table
async function renderHistory(filters = {}){
  const tbl = document.querySelector('#historyTable tbody');
  if(!tbl) return;
  const data = await loadComplaints(filters);
  tbl.innerHTML = data.length
    ? data.map(complaintRow).join('')
    : '<tr><td colspan="7">No complaints match these filters.</td></tr>';
}

// Render dashboard statistics
async function renderStats(){
  const grid = document.getElementById('statsGrid');
  if(!grid) return;
  const data = await loadComplaints();
  const total = data.length;
  const pending = data.filter(d=>d.status==='Pending').length;
  const inProgress = data.filter(d=>d.status==='In Progress').length;
  const resolved = data.filter(d=>d.status==='Resolved').length;
  const html = `
    <div class="stats-card"><div class="label">Total Complaints</div><div class="number">${total}</div></div>
    <div class="stats-card"><div class="label">Pending</div><div class="number">${pending}</div></div>
    <div class="stats-card"><div class="label">In Progress</div><div class="number">${inProgress}</div></div>
    <div class="stats-card"><div class="label">Resolved</div><div class="number">${resolved}</div></div>
  `;
  grid.innerHTML = html;
}

function initCitizenHeader() {
  const name = document.getElementById('citizenName');
  if (name) name.textContent = currentCitizen()?.full_name || 'CityWatch citizen';
}

function initLogout() {
  const button = document.getElementById('logoutButton');
  if (!button) return;
  button.addEventListener('click', () => {
    sessionStorage.removeItem('citywatch_citizen');
    window.location.href = 'index.html';
  });
}

async function renderDetails() {
  const container = document.getElementById('complaintDetails');
  const message = document.getElementById('detailsMessage');
  if (!container) return;
  const complaintId = new URLSearchParams(window.location.search).get('id');
  if (!complaintId) throw new Error('A complaint ID is required.');
  const data = await api(
    `/api/complaints/${encodeURIComponent(complaintId)}?citizenId=${requireCitizen().citizen_id}`
  );
  const c = data.complaint;
  container.innerHTML = `
    <section class="card detail-card">
      <div class="detail-header">
        <div><p class="eyebrow">Complaint #${c.complaint_id}</p><h2>${escapeHtml(c.title)}</h2></div>
        ${statusBadge(c.status)}
      </div>
      <p>${escapeHtml(c.description)}</p>
      <dl class="detail-list">
        <dt>Department</dt><dd>${escapeHtml(c.department)}</dd>
        <dt>Category</dt><dd>${escapeHtml(c.category)}</dd>
        <dt>Priority</dt><dd>${escapeHtml(c.priority)}</dd>
        <dt>Submitted</dt><dd>${formatDate(c.submitted_at)}</dd>
        <dt>Resolved</dt><dd>${formatDate(c.resolved_at)}</dd>
        <dt>Assigned staff</dt><dd>${escapeHtml(c.assigned_staff || 'Not assigned')}</dd>
        <dt>Location</dt><dd>${escapeHtml([c.area_name, c.city, c.district, c.pincode].join(', '))}</dd>
      </dl>
    </section>
    <section class="card">
      <h2>Status history</h2>
      ${data.history.length ? `<ol class="timeline">${data.history.map(item => `
        <li><strong>${escapeHtml(item.new_status)}</strong><span>${formatDate(item.changed_at)}</span>
          ${item.remarks ? `<p>${escapeHtml(item.remarks)}</p>` : ''}</li>`).join('')}</ol>` :
        '<p class="muted">No status history has been recorded.</p>'}
    </section>
    <section class="card">
      <h2>Feedback</h2>
      ${data.feedback.length ? data.feedback.map(item =>
        `<p><strong>${item.rating}/5</strong> ${escapeHtml(item.comments || '')}</p>`).join('') :
        '<p class="muted">No feedback submitted yet.</p>'}
      <form id="feedbackForm" class="form">
        <label for="rating">Rating</label>
        <select id="rating" name="rating" required>
          <option value="">Choose a rating</option><option value="5">5 — Excellent</option>
          <option value="4">4 — Good</option><option value="3">3 — Average</option>
          <option value="2">2 — Poor</option><option value="1">1 — Very poor</option>
        </select>
        <label for="comments">Comments</label>
        <textarea id="comments" name="comments" rows="3" maxlength="2000"></textarea>
        <button class="btn primary" type="submit">Submit feedback</button>
      </form>
    </section>`;
  const form = document.getElementById('feedbackForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api(`/api/complaints/${encodeURIComponent(complaintId)}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          citizenId: requireCitizen().citizen_id,
          rating: Number(form.rating.value),
          comments: form.comments.value.trim() || null
        })
      });
      message.textContent = 'Feedback submitted successfully.';
      await renderDetails();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
}

function initHistoryFilters() {
  const controls = ['historySearch', 'historyStatus', 'historyPriority', 'historySort']
    .map(id => document.getElementById(id));
  if (controls.some(control => !control)) return;
  const refresh = async () => {
    const message = document.getElementById('historyMessage');
    message.textContent = 'Loading complaints...';
    try {
      await renderHistory({
        search: controls[0].value.trim(),
        status: controls[1].value,
        priority: controls[2].value,
        sort: controls[3].value
      });
      message.textContent = '';
    } catch (error) {
      message.textContent = error.message;
    }
  };
  controls.forEach(control => control.addEventListener('input', refresh));
  refresh();
}

// Look up an existing citizen by email
function initLogin(){
  const form = document.getElementById('loginForm');
  if(!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.email.value.trim();
    if(!email){ alert('Please enter your citizen email'); return; }
    try {
      const citizen = await api('/api/citizens/lookup', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      sessionStorage.setItem('citywatch_citizen', JSON.stringify(citizen));
      window.location.href = 'dashboard.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

// Validate and submit new complaint form
function initNewComplaint(){
  const form = document.getElementById('complaintForm');
  if(!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const title = form.title.value.trim();
    const departmentId = Number(form.department.value);
    const category = form.category.value.trim();
    const description = form.description.value.trim();
    const location = {
      areaName: form.areaName.value.trim(),
      city: form.city.value.trim(),
      district: form.district.value.trim(),
      pincode: form.pincode.value.trim()
    };
    if(!title || !departmentId || !category || !description ||
      Object.values(location).some(value => !value)){
      alert('Please fill all required fields');
      return;
    }
    try {
      await api('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          citizenId: requireCitizen().citizen_id,
          departmentId,
          title,
          category,
          description,
          location
        })
      });
      alert('Complaint submitted successfully');
      window.location.href = 'history.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

async function initDepartments() {
  const select = document.getElementById('department');
  if (!select) return;
  try {
    const departments = await api('/api/departments');
    select.innerHTML = '<option value="">Select department</option>' +
      departments.map(department =>
        `<option value="${department.dept_id}">${escapeHtml(department.dept_name)}</option>`
      ).join('');
  } catch (error) {
    select.innerHTML = '<option value="">Unable to load departments</option>';
    alert(error.message);
  }
}

async function initPage(){
  initCitizenHeader();
  initLogout();
  const page = document.body.id;
  if(page === 'page-dashboard'){
    try { await renderStats(); await renderRecent(); } catch (error) { alert(error.message); }
  }
  if(page === 'page-history'){
    initHistoryFilters();
  }
  if(page === 'page-details'){
    try { await renderDetails(); } catch (error) {
      document.getElementById('detailsMessage').textContent = error.message;
    }
  }
  await initDepartments();
  initLogin();
  initNewComplaint();
}

// Run init after DOM loads
document.addEventListener('DOMContentLoaded', initPage);
