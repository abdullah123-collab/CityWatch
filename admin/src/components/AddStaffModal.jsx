import React, { useEffect, useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';

export default function AddStaffModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    designation: '',
    deptId: '',
    roleName: 'Staff',
    password: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/departments', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setDepartments(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setForm((prev) => ({ ...prev, deptId: String(data[0].dept_id) }));
        }
      })
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setBusy(true);

    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff account.');

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
          Provision New Staff Account
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 18 }}>
          Create an individual authenticated officer account with department assignment.
        </p>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              name="fullName"
              className="form-control"
              value={form.fullName}
              onChange={handleChange}
              placeholder="e.g. Tariq Mehmood"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Official Email *</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                placeholder="officer@citywatch.gov"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                name="phone"
                className="form-control"
                value={form.phone}
                onChange={handleChange}
                placeholder="03001234567"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select
                name="deptId"
                className="form-control"
                value={form.deptId}
                onChange={handleChange}
                required
              >
                {departments.map((d) => (
                  <option key={d.dept_id} value={d.dept_id}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Designation / Role *</label>
              <input
                type="text"
                name="designation"
                className="form-control"
                value={form.designation}
                onChange={handleChange}
                placeholder="e.g. Senior Road Inspector"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Temporary Initial Password *</label>
            <input
              type="password"
              name="password"
              className="form-control"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 8 characters"
              required
              minLength={8}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <UserPlus size={15} />
              {busy ? 'Creating Account…' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
