import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { Search, Filter, PlusCircle, FileText, MapPin, Calendar, Paperclip, ChevronRight } from 'lucide-react';

export default function ComplaintHistoryPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [priority, setPriority] = useState('All');
  const [sort, setSort] = useState('newest');

  function fetchComplaints() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status !== 'All') params.set('status', status);
    if (priority !== 'All') params.set('priority', priority);
    params.set('sort', sort);

    fetch(`/api/complaints?${params.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setComplaints(data))
      .catch((err) => console.error('Failed to load complaints', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchComplaints();
  }, [status, priority, sort]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchComplaints();
  }

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 28
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Records & Grievances
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
            My Complaints History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Search, filter, and track status updates across all your submitted civic reports.
          </p>
        </div>

        <Link to="/complaints/new" className="btn btn-primary" style={{ padding: '12px 20px' }}>
          <PlusCircle size={18} />
          Report New Issue
        </Link>
      </div>

      {/* FILTER CONTROLS */}
      <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Search by title, description or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
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

          <div style={{ width: '160px' }}>
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

          <div style={{ width: '160px' }}>
            <select
              className="form-control"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '10px 18px' }}>
            Search
          </button>
        </form>
      </div>

      {/* RESULTS LIST */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading records from SQL Server…
        </div>
      ) : complaints.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <FileText size={42} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>No matching complaints found</h3>
          <p style={{ fontSize: '0.9rem', marginTop: 6 }}>
            Try adjusting your search criteria or report a new civic concern.
          </p>
          <Link to="/complaints/new" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
            Report Issue
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {complaints.map((c) => (
            <div key={c.complaint_id} className="card" style={{ marginBottom: 0, padding: 24, transition: 'box-shadow 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>#{c.complaint_id}</span>
                    <StatusBadge status={c.status} />
                    <span className={`badge badge-${c.priority ? c.priority.toLowerCase() : 'medium'}`}>
                      {c.priority} Priority
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {c.department}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                    <Link to={`/complaints/${c.complaint_id}`}>{c.title}</Link>
                  </h3>

                  <p style={{ fontSize: '0.9rem', color: 'var(--slate-600)', marginBottom: 12, lineHeight: 1.5 }}>
                    {c.description ? (c.description.length > 180 ? `${c.description.slice(0, 180)}…` : c.description) : ''}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MapPin size={15} color="var(--primary)" />
                      {[c.area_name, c.city].filter(Boolean).join(', ')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={15} />
                      {new Date(c.submitted_at).toLocaleDateString()}
                    </span>
                    {c.attachment_count > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Paperclip size={15} />
                        {c.attachment_count} attachment{c.attachment_count > 1 ? 's' : ''}
                      </span>
                    )}
                    {c.assigned_staff && (
                      <span>Officer: <strong>{c.assigned_staff}</strong></span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center' }}>
                  <Link to={`/complaints/${c.complaint_id}`} className="btn btn-outline btn-sm">
                    View Progress <ChevronRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
