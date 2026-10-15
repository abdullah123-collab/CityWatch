import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, ShieldAlert } from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadLogs() {
    setLoading(true);
    fetch('/api/admin/audit-logs', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            System Audit Trail & Security Logs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Live immutable audit log records from SQL Server dbo.Audit_Log table.
          </p>
        </div>
        <button onClick={loadLogs} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Querying dbo.Audit_Log from SQL Server…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No audit records found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Action Type</th>
                  <th>Target Table</th>
                  <th>Record ID</th>
                  <th>Action Details</th>
                  <th>Actor / Source</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.audit_id}>
                    <td><strong>#{log.audit_id}</strong></td>
                    <td>
                      <span className={`badge ${log.action_type === 'DELETE' ? 'badge-rejected' : log.action_type === 'UPDATE' ? 'badge-in-progress' : 'badge-resolved'}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td><code>{log.table_name || 'System'}</code></td>
                    <td>{log.record_id ? `#${log.record_id}` : '—'}</td>
                    <td style={{ fontSize: '0.85rem', maxWidth: '380px' }}>
                      {log.action_details}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.action_by}</span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.action_at).toLocaleString()}
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
