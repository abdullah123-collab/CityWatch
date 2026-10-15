import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import WorkloadBar from '../components/WorkloadBar';
import StatusUpdateModal from '../components/StatusUpdateModal';
import { Briefcase, Clock, AlertCircle, CheckCircle2, ChevronRight, MapPin, Calendar, Paperclip, RefreshCw } from 'lucide-react';

export default function StaffDashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status update modal state
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  function loadData() {
    setLoading(true);
    Promise.all([
      fetch('/api/staff/dashboard', { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/staff/complaints?status=${statusFilter}&search=${encodeURIComponent(search)}`, { credentials: 'include' }).then((r) => r.json())
    ])
      .then(([dash, comps]) => {
        setDashboardData(dash);
        setComplaints(Array.isArray(comps) ? comps : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  function handleSearch(e) {
    e.preventDefault();
    loadData();
  }

  function openStatusModal(complaint) {
    setSelectedComplaint(complaint);
    setModalOpen(true);
  }

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            Officer Case Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Review assigned municipal grievances, conduct inspections, and record official status updates.
          </p>
        </div>
        <button onClick={loadData} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {dashboardData && (
        <WorkloadBar
          activeCases={dashboardData.workload.activeCases}
          maxCapacity={dashboardData.workload.maxCapacity}
        />
      )}

      {/* METRIC COUNTERS */}
      {dashboardData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ASSIGNED</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{dashboardData.counts.total}</h3>
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
            <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>PENDING INSPECTION</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#b45309' }}>{dashboardData.counts.pending}</h3>
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
            <span style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 600 }}>IN PROGRESS</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#0369a1' }}>{dashboardData.counts.inProgress}</h3>
          </div>
          <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
            <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>RESOLVED</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#15803d' }}>{dashboardData.counts.resolved}</h3>
          </div>
        </div>
      )}

      {/* ASSIGNED COMPLAINTS SECTION */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Assigned Complaints</h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              className="form-control"
              style={{ width: '220px' }}
              placeholder="Search assigned cases…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: '150px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm">Filter</button>
          </form>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading assigned records from SQL Server…
          </div>
        ) : complaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Briefcase size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600 }}>No complaints currently assigned matching this criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Title & Citizen</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.complaint_id}>
                    <td><strong>#{c.complaint_id}</strong></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Citizen: {c.citizen_name} ({c.citizen_phone || 'No phone'})
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${c.priority ? c.priority.toLowerCase() : 'medium'}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {[c.area_name, c.city].filter(Boolean).join(', ')}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => openStatusModal(c)}
                          className="btn btn-primary btn-sm"
                        >
                          Update Status
                        </button>
                        <Link to={`/complaints/${c.complaint_id}`} className="btn btn-outline btn-sm">
                          Review Case
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StatusUpdateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        complaint={selectedComplaint}
        onSuccess={loadData}
      />
    </div>
  );
}
