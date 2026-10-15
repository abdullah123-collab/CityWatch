import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { PlusCircle, Clock, AlertCircle, CheckCircle2, ChevronRight, FileText } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/complaints', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load complaints.');
        return res.json();
      })
      .then((data) => setComplaints(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalCount = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === 'Pending').length;
  const inProgressCount = complaints.filter((c) => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      {/* WELCOME BANNER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 32
        }}
      >
        <div>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Citizen Dashboard
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
            Welcome back, {user ? user.full_name : 'Resident'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Overview of your reported civic issues and active municipality resolutions.
          </p>
        </div>
        <Link to="/complaints/new" className="btn btn-primary" style={{ padding: '12px 20px' }}>
          <PlusCircle size={18} />
          Report New Issue
        </Link>
      </div>

      {/* REAL SQL DATABASE STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span>Total Reported</span>
            <h3>{totalCount}</h3>
          </div>
          <div className="stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <FileText size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span>Pending Review</span>
            <h3>{pendingCount}</h3>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Clock size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span>In Progress</span>
            <h3>{inProgressCount}</h3>
          </div>
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <AlertCircle size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span>Resolved</span>
            <h3>{resolvedCount}</h3>
          </div>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* RECENT COMPLAINTS TABLE */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Submissions</h2>
          <Link to="/complaints" style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            View All Reports <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading civic records from SQL Server…
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : complaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600 }}>No complaints submitted yet.</p>
            <p style={{ fontSize: '0.88rem', marginTop: 4 }}>
              Notice a pothole, streetlight failure, or waste overflow? Submit a report now.
            </p>
            <Link to="/complaints/new" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
              Report Your First Issue
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title & Category</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.slice(0, 5).map((c) => (
                  <tr key={c.complaint_id}>
                    <td>
                      <strong>#{c.complaint_id}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.category}</span>
                    </td>
                    <td>{c.department}</td>
                    <td>
                      <span className={`badge badge-${c.priority ? c.priority.toLowerCase() : 'medium'}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(c.submitted_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/complaints/${c.complaint_id}`} className="btn btn-outline btn-sm">
                        View Details
                      </Link>
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
