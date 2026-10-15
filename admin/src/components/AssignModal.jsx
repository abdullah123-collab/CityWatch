import React, { useEffect, useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';

export default function AssignModal({ isOpen, onClose, complaint, onSuccess }) {
  if (!isOpen || !complaint) return null;

  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/staff', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        // Filter active staff
        const active = (Array.isArray(data) ? data : []).filter((s) => s.is_active !== false && s.email !== 'admin@citywatch.gov');
        setStaffList(active);
        if (active.length > 0) {
          // Default to matching department if available
          const deptMatch = active.find((s) => s.dept_id === complaint.dept_id && s.active_cases < 5);
          setSelectedStaffId(deptMatch ? String(deptMatch.staff_id) : String(active[0].staff_id));
        }
      })
      .catch((err) => console.error('Failed to load staff list', err));
  }, [complaint]);

  async function handleAssign(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const res = await fetch(`/api/admin/complaints/${complaint.complaint_id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ staffId: Number(selectedStaffId) })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign complaint.');

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
          Assign Complaint to Staff Officer
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 18 }}>
          Complaint #{complaint.complaint_id}: {complaint.title} ({complaint.department})
        </p>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAssign}>
          <div className="form-group">
            <label className="form-label">Select Municipal Staff Officer</label>
            <select
              className="form-control"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              required
            >
              {staffList.map((s) => {
                const atCapacity = s.active_cases >= 5;
                const isDept = s.dept_id === complaint.dept_id;
                return (
                  <option key={s.staff_id} value={s.staff_id} disabled={atCapacity}>
                    {s.full_name} ({s.designation}) — {s.dept_name} — [{s.active_cases}/5 Active Cases] {atCapacity ? '(MAX CAPACITY)' : ''} {isDept ? '★ DEPT MATCH' : ''}
                  </option>
                );
              })}
            </select>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
              Officers at maximum capacity (5 active cases) are disabled per municipal workload constraints.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !selectedStaffId}>
              <UserPlus size={15} />
              {busy ? 'Assigning…' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
