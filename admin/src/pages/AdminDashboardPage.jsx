import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Building2, CheckCircle2, AlertCircle, Clock, Star, ArrowRight, RefreshCw, Briefcase } from 'lucide-react';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadDashboard() {
    setLoading(true);
    fetch('/api/admin/dashboard', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load administrative analytics.');
        return r.json();
      })
      .then((resData) => setData(resData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Querying municipal metrics from SQL Server…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const { metrics, departmentStats, staffWorkload } = data;

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Municipal Executive Overview
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
            CityWatch Command Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Live metrics and cross-departmental operations backed by Microsoft SQL Server.
          </p>
        </div>
        <button onClick={loadDashboard} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh Analytics
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Complaints</span>
          <h3 style={{ color: 'var(--primary)' }}>{metrics.totalComplaints}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Across all departments</span>
        </div>

        <div className="stat-card">
          <span>Pending Triage</span>
          <h3 style={{ color: '#b45309' }}>{metrics.pendingComplaints}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Awaiting review / assignment</span>
        </div>

        <div className="stat-card">
          <span>Under Investigation</span>
          <h3 style={{ color: '#0369a1' }}>{metrics.inProgressComplaints}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active field inspections</span>
        </div>

        <div className="stat-card">
          <span>Resolved</span>
          <h3 style={{ color: '#15803d' }}>{metrics.resolvedComplaints}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Successfully resolved</span>
        </div>

        <div className="stat-card">
          <span>Registered Citizens</span>
          <h3>{metrics.totalCitizens}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified accounts</span>
        </div>

        <div className="stat-card">
          <span>Field Staff</span>
          <h3>{metrics.totalStaff}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active inspectors</span>
        </div>

        <div className="stat-card">
          <span>Citizen Rating</span>
          <h3 style={{ color: '#eab308' }}>★ {metrics.averageRating}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{metrics.totalReviews} total reviews</span>
        </div>
      </div>

      {/* TWO COLUMN: DEPARTMENT PERFORMANCE & STAFF WORKLOAD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* DEPARTMENT PERFORMANCE */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color="var(--primary)" /> Department Grievance Distribution
            </h2>
            <Link to="/departments" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Manage →</Link>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Total Reports</th>
                  <th>Resolved</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.map((d) => {
                  const rate = d.complaint_count > 0 ? Math.round((d.resolved_count / d.complaint_count) * 100) : 0;
                  return (
                    <tr key={d.dept_id}>
                      <td><strong>{d.dept_name}</strong></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.category}</td>
                      <td>{d.complaint_count}</td>
                      <td>{d.resolved_count}</td>
                      <td>
                        <span className="badge badge-resolved">{rate}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* STAFF WORKLOAD MONITOR */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={18} color="var(--primary)" /> Officer Workload Monitor
            </h2>
            <Link to="/staff" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Directory →</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {staffWorkload.map((s) => {
              const pct = (s.active_cases / 5) * 100;
              let barColor = '#16a34a';
              if (s.active_cases >= 4) barColor = '#dc2626';
              else if (s.active_cases >= 3) barColor = '#d97706';

              return (
                <div key={s.staff_id} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.full_name}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: barColor }}>
                      {s.active_cases} / 5 Cases
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    {s.designation} • {s.dept_name}
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
