import React, { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, X, AlertCircle } from 'lucide-react';

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    deptName: '',
    category: '',
    contactEmail: '',
    contactPhone: '',
    headOfficer: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function loadDepts() {
    setLoading(true);
    fetch('/api/admin/departments', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDepts();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create department.');
      setModalOpen(false);
      setForm({ deptName: '', category: '', contactEmail: '', contactPhone: '', headOfficer: '' });
      loadDepts();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            Municipal Departments & Jurisdictions
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Administrative management of municipal service branches.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadDepts} className="btn btn-outline btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Add Department
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Retrieving departments from SQL Server…
          </div>
        ) : departments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No departments found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Dept ID</th>
                  <th>Department Name</th>
                  <th>Grievance Category</th>
                  <th>Head Officer</th>
                  <th>Contact Email</th>
                  <th>Assigned Staff</th>
                  <th>Total Complaints</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.dept_id}>
                    <td><strong>#{d.dept_id}</strong></td>
                    <td style={{ fontWeight: 700 }}>{d.dept_name}</td>
                    <td>{d.category}</td>
                    <td>{d.head_officer || 'Municipal Officer'}</td>
                    <td>{d.contact_email || 'dept@citywatch.gov'}</td>
                    <td>
                      <span className="badge badge-in-progress">{d.staff_count || 0} Officers</span>
                    </td>
                    <td>
                      <strong>{d.total_complaints || 0}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16 }}>
              Add Municipal Department
            </h2>

            {error && (
              <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.deptName}
                  onChange={(e) => setForm({ ...form, deptName: e.target.value })}
                  placeholder="e.g. Parks and Horticulture"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Grievance Category *</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Greenery & Public Grounds"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Head Officer</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.headOfficer}
                  onChange={(e) => setForm({ ...form, headOfficer: e.target.value })}
                  placeholder="e.g. Director General"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="dept@citywatch.gov"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="051-9000000"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline" disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
