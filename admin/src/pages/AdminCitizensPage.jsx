import React, { useEffect, useState } from 'react';
import { Users, Mail, Phone, MapPin, RefreshCw } from 'lucide-react';

export default function AdminCitizensPage() {
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadCitizens() {
    setLoading(true);
    fetch('/api/admin/citizens', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setCitizens(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCitizens();
  }, []);

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            Registered Citizen Registry
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Directory of all verified resident accounts stored in Microsoft SQL Server.
          </p>
        </div>
        <button onClick={loadCitizens} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Retrieving citizen records from SQL Server…
          </div>
        ) : citizens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No registered citizens found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Citizen ID</th>
                  <th>Full Name</th>
                  <th>Contact Email</th>
                  <th>Phone Number</th>
                  <th>Address</th>
                  <th>Complaints Submitted</th>
                  <th>Registered Date</th>
                </tr>
              </thead>
              <tbody>
                {citizens.map((c) => (
                  <tr key={c.citizen_id}>
                    <td><strong>#{c.citizen_id}</strong></td>
                    <td style={{ fontWeight: 700 }}>{c.full_name}</td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>{c.address || 'Standard Municipality'}</td>
                    <td>
                      <span className="badge badge-in-progress">
                        {c.complaint_count || 0} Reports
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {c.registered_at ? new Date(c.registered_at).toLocaleDateString() : 'N/A'}
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
