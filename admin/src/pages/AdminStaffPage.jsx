import React, { useEffect, useState } from 'react';
import AddStaffModal from '../components/AddStaffModal';
import { UserPlus, Users, CheckCircle2, XCircle, RefreshCw, Briefcase } from 'lucide-react';

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  function loadStaff() {
    setLoading(true);
    fetch('/api/admin/staff', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setStaffList(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function toggleStatus(staff) {
    const nextStatus = staff.is_active === false ? true : false;
    try {
      const res = await fetch(`/api/admin/staff/${staff.staff_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: nextStatus })
      });
      if (res.ok) {
        loadStaff();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="container" style={{ padding: '36px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>
            Municipal Staff Account Directory
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Manage individual inspector accounts, department assignments, active case limits, and access privileges.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadStaff} className="btn btn-outline btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary btn-sm">
            <UserPlus size={16} /> Add New Staff Member
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Retrieving staff registry from SQL Server…
          </div>
        ) : staffList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <p>No staff accounts registered.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name & Designation</th>
                  <th>Department</th>
                  <th>Contact Email</th>
                  <th>Workload Capacity</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => {
                  const isActive = s.is_active !== false;
                  const isSuperAdmin = s.email === 'admin@citywatch.gov';
                  return (
                    <tr key={s.staff_id}>
                      <td><strong>#{s.staff_id}</strong></td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.designation}</span>
                      </td>
                      <td>{s.dept_name}</td>
                      <td>{s.email}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: s.active_cases >= 5 ? '#b91c1c' : '#15803d' }}>
                          {s.active_cases} / 5 Cases
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-in-progress">{s.role_name || 'Staff'}</span>
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleStatus(s)}
                            className={`btn ${isActive ? 'btn-outline' : 'btn-primary'} btn-sm`}
                            style={{ fontSize: '0.78rem' }}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddStaffModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadStaff}
      />
    </div>
  );
}
