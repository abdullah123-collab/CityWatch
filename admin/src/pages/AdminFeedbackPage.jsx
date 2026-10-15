import React, { useEffect, useState } from 'react';
import { Star, RefreshCw, MessageSquare } from 'lucide-react';

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadFeedback() {
    setLoading(true);
    fetch('/api/admin/feedback', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setFeedback(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFeedback();
  }, []);

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            Citizen Satisfaction & Review Reports
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Direct citizen feedback, service satisfaction ratings, and inspector reviews stored in SQL Server.
          </p>
        </div>
        <button onClick={loadFeedback} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Retrieving citizen feedback from SQL Server…
          </div>
        ) : feedback.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <MessageSquare size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <p>No citizen feedback submitted yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Review ID</th>
                  <th>Complaint Case</th>
                  <th>Department</th>
                  <th>Rating</th>
                  <th>Comments</th>
                  <th>Citizen</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((fb) => (
                  <tr key={fb.feedback_id}>
                    <td><strong>#{fb.feedback_id}</strong></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>#{fb.complaint_id}</div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fb.complaint_title}</span>
                    </td>
                    <td>{fb.dept_name}</td>
                    <td>
                      <div style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {'★'.repeat(fb.rating)}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({fb.rating}/5)</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: '300px', fontStyle: fb.comments ? 'italic' : 'normal' }}>
                      {fb.comments || 'No comment provided.'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{fb.citizen_name}</div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fb.citizen_email}</span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(fb.submitted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
