/*
  script.js — handles dummy data, form validation, and page-specific rendering
  Keep logic simple for learning and easy explanation in interviews.
*/

// Local storage key for complaints
const STORAGE_KEY = 'citywatch_complaints_v1';

// Sample dummy data used when no data exists yet
const SAMPLE = [
  {id: 'CW-1001', title: 'Potholes on King Ave', department: 'Roads', status: 'Pending', date: '2026-06-20'},
  {id: 'CW-1002', title: 'Street light not working', department: 'Street Lights', status: 'In Progress', date: '2026-06-22'},
  {id: 'CW-1003', title: 'Water leakage near block B', department: 'Water', status: 'Resolved', date: '2026-06-25'},
  {id: 'CW-1004', title: 'Overflowing garbage bin', department: 'Sanitation', status: 'Pending', date: '2026-06-28'}
];

// Utility: read complaints from localStorage or initialize with SAMPLE
function loadComplaints(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE));
    return SAMPLE.slice();
  }
  try{ return JSON.parse(raw) } catch(e){ return SAMPLE.slice() }
}

// Utility: save complaints array to localStorage
function saveComplaints(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Generate readable ID for a new complaint
function generateID(){
  const n = Math.floor(Math.random()*9000)+1000;
  return `CW-${n}`;
}

// Format date as YYYY-MM-DD
function formatDate(d=new Date()){ return d.toISOString().split('T')[0]; }

// Create status badge element (returns HTML string)
function statusBadge(status){
  const cls = status === 'Resolved' ? 'green' : status === 'In Progress' ? 'orange' : 'red';
  return `<span class="badge ${cls}">${status}</span>`;
}

// Render recent complaints in dashboard table (top 5)
function renderRecent(){
  const tbl = document.querySelector('#recentTable tbody');
  if(!tbl) return;
  const data = loadComplaints();
  const rows = data.slice().reverse().slice(0,5).map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.title}</td>
      <td>${c.department}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.date}</td>
    </tr>
  `).join('');
  tbl.innerHTML = rows;
}

// Render full history table
function renderHistory(){
  const tbl = document.querySelector('#historyTable tbody');
  if(!tbl) return;
  const data = loadComplaints();
  const rows = data.slice().reverse().map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.title}</td>
      <td>${c.department}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.date}</td>
    </tr>
  `).join('');
  tbl.innerHTML = rows;
}

// Render dashboard statistics
function renderStats(){
  const grid = document.getElementById('statsGrid');
  if(!grid) return;
  const data = loadComplaints();
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

// Validate login form (simple check: email + password not empty)
function initLogin(){
  const form = document.getElementById('loginForm');
  if(!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value.trim();
    if(!email || !password){ alert('Please enter email and password'); return; }
    // For demo, accept any credentials and redirect to dashboard
    window.location.href = 'dashboard.html';
  });
}

// Validate and submit new complaint form
function initNewComplaint(){
  const form = document.getElementById('complaintForm');
  if(!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = form.title.value.trim();
    const department = form.department.value.trim();
    const description = form.description.value.trim();
    if(!title || !department || !description){ alert('Please fill required fields'); return; }
    const complaints = loadComplaints();
    const newC = { id: generateID(), title, department, status: 'Pending', date: formatDate() };
    complaints.push(newC);
    saveComplaints(complaints);
    alert('Complaint submitted successfully');
    window.location.href = 'history.html';
  });
}

// Initialize page-specific behaviors
function initPage(){
  // Common: ensure storage exists
  loadComplaints();
  // Page-specific
  const page = document.body.id;
  if(page === 'page-dashboard'){
    renderStats(); renderRecent();
  }
  if(page === 'page-history'){
    renderHistory();
  }
  if(page === 'page-home'){
    // nothing special for now
  }
  // Form initializers
  initLogin(); initNewComplaint();
}

// Run init after DOM loads
document.addEventListener('DOMContentLoaded', initPage);
