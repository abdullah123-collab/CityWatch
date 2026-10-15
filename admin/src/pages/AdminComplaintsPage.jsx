import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AssignModal from '../components/AssignModal';
import { Search, Filter, UserPlus, RefreshCw, ChevronRight } from 'lucide-react';

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [deptId, setDeptId] = useState('');
  const [status, setStatus] = useState('All');
  const [priority, setPriority] = useState('All');

  // Assignment Modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  function loadComplaints() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (deptId) params.set('departmentId', deptId);
    if (status !== 'All') params.set('status', status);
    if (priority !== 'All') params.set('priority', priority);

    fetch(`/api/admin/complaints?${params.toString()}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setComplaints(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch('/api/admin/departments', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [deptId, status, priority]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadComplaints();
  }

  function openAssign(c) {
    setSelectedComplaint(c);
    setModalOpen(true);
  }

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            City-Wide Complaints Registry
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Monitor and route all municipal grievances, assign field inspectors, and enforce workload constraints.
          </p>
        </div>
        <button onClick={loadComplaints} className="btn btn-outline btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* FILTERS */}
      <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search title, citizen name, or keywords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ width: '200px' }}>
            <select
              className="form-control"
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '150px' }}>
            <select
              className="form-control"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div style={{ width: '150px' }}>
            <select
              className="form-control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="All">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm">
            Filter
          </button>
        </form>
      </div>

      {/* TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Retrieving records from SQL Server…
          </div>
        ) : complaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            No complaints found matching this criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Title & Citizen</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Officer</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.complaint_id}>
                    <td><strong>#{c.complaint_id}</strong></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Resident: {c.citizen_name} ({c.citizen_email})
                      </span>
                    </td>
                    <td>{c.department}</td>
                    <td>
                      <span className={`badge badge-${c.priority ? c.priority.toLowerCase() : 'medium'}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      {c.assigned_staff ? (
                        <span style={{ fontWeight: 600 }}>{c.assigned_staff}</span>
                      ) : (
                        <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.85rem' }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(c.submitted_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => openAssign(c)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <UserPlus size={14} />
                        {c.assigned_staff ? 'Reassign' : 'Assign Staff'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        complaint={selectedComplaint}
        onSuccess={loadComplaints}
      />
    </div>
  );
}
