import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

export default function StatusUpdateModal({ isOpen, onClose, complaint, onSuccess }) {
  if (!isOpen || !complaint) return null;

  const [status, setStatus] = useState(complaint.status || 'In Progress');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const res = await fetch(`/api/staff/complaints/${complaint.complaint_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, remarks })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status.');

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

        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>
          Update Complaint Status
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Case #{complaint.complaint_id}: {complaint.title}
        </p>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Status</label>
            <select
              className="form-control"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="In Progress">In Progress (Field Work Underway)</option>
              <option value="Resolved">Resolved (Issue Addressed & Rectified)</option>
              <option value="Rejected">Rejected (Out of Municipal Scope / Invalid)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Inspector Remarks / Action Taken</label>
            <textarea
              className="form-control"
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Detail actions taken, inspection findings, materials dispatched, or reasons for rejection."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving to Database…' : 'Save Status Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
