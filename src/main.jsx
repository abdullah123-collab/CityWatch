import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import './styles.css';

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api('/api/auth/me').then(data => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  return { user, loading, setUser };
}

function Layout({ user, setUser, children }) {
  const navigate = useNavigate();
  async function logout() { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); navigate('/'); }
  return <div className="app-shell"><header className="topbar"><Link className="brand" to="/"><span className="brand-mark">CW</span> CityWatch</Link><nav><Link to="/dashboard">Dashboard</Link>{user ? <><Link to="/complaints">My complaints</Link><Link to="/complaints/new">Report issue</Link><button className="text-button" onClick={logout}>Sign out</button></> : <><Link to="/login">Sign in</Link><Link className="nav-cta" to="/register">Create account</Link></>}</nav></header><main>{children}</main><footer><strong>CityWatch</strong><span>Making civic services easier to reach.</span></footer></div>;
}

function Guard({ user, loading, children }) { if (loading) return <Loading />; return user ? children : <Navigate to="/login" replace />; }
function Loading() { return <div className="state-card"><div className="spinner" />Loading…</div>; }
function ErrorMessage({ children }) { return children ? <div className="error-message" role="alert">{children}</div> : null; }
function StatusBadge({ status }) { return <span className={`status status-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>; }
function Field({ label, name, type = 'text', value, onChange, required }) { return <label className="field"><span>{label}</span><input name={name} type={type} value={value} onChange={onChange} required={required} autoComplete={type === 'password' ? 'new-password' : name} /></label>; }

function Landing() {
  return <div className="landing"><section className="hero container"><div className="hero-copy"><p className="kicker">Civic service, made visible</p><h1>Report an issue.<br /><em>See progress.</em></h1><p className="hero-lead">CityWatch connects residents with the teams responsible for keeping neighborhoods safe, clean, and moving.</p><div className="hero-actions"><Link className="button button-primary" to="/register">Create an account</Link><Link className="button button-quiet" to="/login">Track a complaint</Link></div><div className="trust-row"><span>✓ Secure records</span><span>✓ Real-time status</span><span>✓ Department routing</span></div></div><div className="hero-panel"><div className="panel-top"><span className="live-dot" />Live service overview <span>Today</span></div><div className="hero-stat"><strong>One clear place</strong><span>to report and follow civic issues</span></div><div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /></div><div className="hero-panel-foot"><span>Submission</span><b>→</b><span>Resolution</span></div></div></section><section className="container process"><p className="kicker">How it works</p><h2>From concern to change.</h2><div className="process-grid">{[['01', 'Tell us what happened', 'Share the details and location so your report reaches the right team.'], ['02', 'We route it', 'Your department receives a structured complaint they can act on.'], ['03', 'You stay informed', 'Follow status updates and resolution notes from your dashboard.']].map(item => <article key={item[0]}><span>{item[0]}</span><h3>{item[1]}</h3><p>{item[2]}</p></article>)}</div></section></div>;
}

function AuthForm({ mode, setUser }) {
  const register = mode === 'register'; const navigate = useNavigate();
  const [form, setForm] = useState(register ? { fullName: '', email: '', phone: '', address: '', password: '', confirmPassword: '' } : { email: '', password: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  async function submit(event) { event.preventDefault(); setError(''); if (register && form.password !== form.confirmPassword) return setError('Passwords do not match.'); if (register && form.password.length < 8) return setError('Password must contain at least 8 characters.'); setBusy(true); try { const data = await api(register ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: JSON.stringify(form) }); setUser(data.user); navigate('/dashboard'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="auth-page"><div className="auth-card"><p className="kicker">{register ? 'Join CityWatch' : 'Welcome back'}</p><h1>{register ? 'Create your account' : 'Sign in to CityWatch'}</h1><p className="muted">{register ? 'Create a secure account to report and track civic issues.' : 'Access your reports and follow their progress.'}</p><ErrorMessage>{error}</ErrorMessage><form onSubmit={submit}>{register && <><Field label="Full name" name="fullName" value={form.fullName} onChange={update} required /><Field label="Phone number" name="phone" value={form.phone} onChange={update} required /><Field label="Address" name="address" value={form.address} onChange={update} /></>}<Field label="Email address" name="email" type="email" value={form.email} onChange={update} required /><Field label="Password" name="password" type="password" value={form.password} onChange={update} required />{register && <Field label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} required />}<button className="button button-primary full" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></form><p className="auth-switch">{register ? 'Already registered?' : 'New to CityWatch?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p></div></div>;
}

function ComplaintTable({ complaints }) { return complaints.length ? <div className="table-wrap"><table><thead><tr><th>Complaint</th><th>Department</th><th>Priority</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{complaints.map(c => <tr key={c.complaint_id}><td><Link to={`/complaints/${c.complaint_id}`}><strong>#{c.complaint_id}</strong><br />{c.title}</Link></td><td>{c.department}</td><td>{c.priority}</td><td><StatusBadge status={c.status} /></td><td>{new Date(c.submitted_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="empty">No complaints yet. Your first report starts here.</div>; }

function Dashboard({ user }) {
  const [complaints, setComplaints] = useState(null); useEffect(() => { api('/api/complaints').then(setComplaints).catch(() => setComplaints([])); }, []);
  if (!complaints) return <Loading />; const stats = ['All', 'Pending', 'In Progress', 'Resolved'].map(status => [status, status === 'All' ? complaints.length : complaints.filter(c => c.status === status).length]);
  return <div className="container page"><div className="page-intro"><div><p className="kicker">Citizen dashboard</p><h1>Good to see you, {user.full_name.split(' ')[0]}.</h1><p className="muted">Here is the latest view of your civic reports.</p></div><Link className="button button-primary" to="/complaints/new">＋ Report an issue</Link></div><div className="stats">{stats.map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="content-card"><div className="section-head"><div><p className="kicker">Latest activity</p><h2>Your complaints</h2></div><Link to="/complaints">View all →</Link></div><ComplaintTable complaints={complaints.slice(0, 5)} /></section></div>;
}

function Complaints() {
  const [complaints, setComplaints] = useState(null); const [filters, setFilters] = useState({ search: '', status: '' });
  useEffect(() => { const params = new URLSearchParams(filters); api(`/api/complaints?${params}`).then(setComplaints).catch(() => setComplaints([])); }, [filters]);
  return <div className="container page"><div className="page-intro"><div><p className="kicker">Your records</p><h1>My complaints</h1></div><Link className="button button-primary" to="/complaints/new">＋ New complaint</Link></div><div className="filters"><input placeholder="Search complaints" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option>Pending</option><option>In Progress</option><option>Resolved</option><option>Rejected</option></select></div><section className="content-card">{complaints ? <ComplaintTable complaints={complaints} /> : <Loading />}</section></div>;
}

function NewComplaint() {
  const navigate = useNavigate(); const [departments, setDepartments] = useState([]); const [form, setForm] = useState({ title: '', category: '', description: '', departmentId: '', priority: 'Medium', areaName: '', city: '', district: '', pincode: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/departments').then(setDepartments).catch(err => setError(err.message)); }, []); function update(e) { setForm({ ...form, [e.target.name]: e.target.value }); } async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await api('/api/complaints', { method: 'POST', body: JSON.stringify({ ...form, departmentId: Number(form.departmentId), location: { areaName: form.areaName, city: form.city, district: form.district, pincode: form.pincode } }) }); navigate('/complaints'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="container page narrow"><p className="kicker">New report</p><h1>Tell us what needs attention.</h1><p className="muted">Include enough detail for the responsible department to act quickly.</p><ErrorMessage>{error}</ErrorMessage><form className="content-card form-grid" onSubmit={submit}><Field label="Complaint title" name="title" value={form.title} onChange={update} required /><label className="field"><span>Department</span><select name="departmentId" value={form.departmentId} onChange={update} required><option value="">Choose department</option>{departments.map(d => <option value={d.dept_id} key={d.dept_id}>{d.dept_name}</option>)}</select></label><Field label="Category" name="category" value={form.category} onChange={update} required /><label className="field full-row"><span>Description</span><textarea name="description" rows="5" value={form.description} onChange={update} required /></label><label className="field"><span>Priority</span><select name="priority" value={form.priority} onChange={update}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><div className="form-divider full-row">Location</div><Field label="Area" name="areaName" value={form.areaName} onChange={update} required /><Field label="City" name="city" value={form.city} onChange={update} required /><Field label="District" name="district" value={form.district} onChange={update} required /><Field label="Pincode" name="pincode" value={form.pincode} onChange={update} required /><button className="button button-primary full-row" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button></form></div>;
}

function ComplaintDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ rating: '5', comments: '' });
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  useEffect(() => { api(`/api/complaints/${id}`).then(setData).catch(err => setError(err.message)); }, [id]);
  if (error) return <div className="container page"><ErrorMessage>{error}</ErrorMessage></div>;
  if (!data) return <Loading />;
  const c = data.complaint;
  async function submitFeedback(event) {
    event.preventDefault();
    setFeedbackError('');
    setFeedbackSaved(false);
    setFeedbackBusy(true);
    try {
      const saved = await api(`/api/complaints/${id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating: Number(feedback.rating), comments: feedback.comments || null })
      });
      setData({ ...data, feedback: [saved, ...data.feedback] });
      setFeedback({ rating: '5', comments: '' });
      setFeedbackSaved(true);
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setFeedbackBusy(false);
    }
  }
  return <div className="container page">
    <Link to="/complaints">← Back to complaints</Link>
    <div className="detail-title"><div><p className="kicker">Complaint #{c.complaint_id}</p><h1>{c.title}</h1></div><StatusBadge status={c.status} /></div>
    <div className="detail-layout">
      <section className="content-card"><p>{c.description}</p><dl className="detail-list"><dt>Department</dt><dd>{c.department}</dd><dt>Priority</dt><dd>{c.priority}</dd><dt>Submitted</dt><dd>{new Date(c.submitted_at).toLocaleString()}</dd><dt>Assigned staff</dt><dd>{c.assigned_staff || 'Not assigned'}</dd><dt>Location</dt><dd>{[c.area_name, c.city, c.district, c.pincode].join(', ')}</dd></dl></section>
      <section className="content-card"><p className="kicker">Timeline</p><h2>Status history</h2>{data.history.length ? <ol className="timeline">{data.history.map(h => <li key={h.history_id}><strong>{h.new_status}</strong><span>{new Date(h.changed_at).toLocaleString()}</span>{h.remarks && <p>{h.remarks}</p>}</li>)}</ol> : <p className="muted">No status history recorded.</p>}</section>
      <section className="content-card"><p className="kicker">Your feedback</p><h2>How did we do?</h2>{data.feedback.length ? <div className="feedback-list">{data.feedback.map(item => <div className="feedback-item" key={item.feedback_id}><strong>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</strong><span>{new Date(item.submitted_at).toLocaleDateString()}</span>{item.comments && <p>{item.comments}</p>}</div>)}</div> : <p className="muted">Share your experience after reviewing this complaint.</p>}<ErrorMessage>{feedbackError}</ErrorMessage>{feedbackSaved && <div className="success-message" role="status">Feedback saved.</div>}<form className="feedback-form" onSubmit={submitFeedback}><label className="field"><span>Rating</span><select value={feedback.rating} onChange={event => setFeedback({ ...feedback, rating: event.target.value })}><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Fair</option><option value="2">2 - Poor</option><option value="1">1 - Very poor</option></select></label><label className="field"><span>Comment (optional)</span><textarea rows="3" value={feedback.comments} onChange={event => setFeedback({ ...feedback, comments: event.target.value })} maxLength="1000" /></label><button className="button button-primary" disabled={feedbackBusy}>{feedbackBusy ? 'Saving…' : 'Save feedback'}</button></form></section>
    </div>
  </div>;
}

function App() { const auth = useAuth(); return <Layout user={auth.user} setUser={auth.setUser}><Routes><Route path="/" element={<Landing />} /><Route path="/login" element={<AuthForm mode="login" setUser={auth.setUser} />} /><Route path="/register" element={<AuthForm mode="register" setUser={auth.setUser} />} /><Route path="/dashboard" element={<Guard {...auth}><Dashboard user={auth.user} /></Guard>} /><Route path="/complaints" element={<Guard {...auth}><Complaints /></Guard>} /><Route path="/complaints/new" element={<Guard {...auth}><NewComplaint /></Guard>} /><Route path="/complaints/:id" element={<Guard {...auth}><ComplaintDetails /></Guard>} /><Route path="*" element={<div className="container page"><h1>Page not found</h1><Link to="/">Return home</Link></div>} /></Routes></Layout>; }

const rootContainer = document.getElementById('root');
const root = globalThis.__citywatchRoot || createRoot(rootContainer);
globalThis.__citywatchRoot = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
