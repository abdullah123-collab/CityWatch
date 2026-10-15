import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '../context/StaffAuthContext';
import { User, Shield, Briefcase, Mail, LogOut, ArrowLeft } from 'lucide-react';

export default function StaffProfilePage() {
  const { user, logout } = useStaffAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '640px' }}>
      <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm" style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: '1.4rem'
            }}
          >
            {user.full_name ? user.full_name.charAt(0) : 'S'}
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
              {user.full_name}
            </h1>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {user.designation} • {user.dept_name}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>OFFICIAL EMAIL</span>
            <p style={{ fontWeight: 700, marginTop: 4 }}>{user.email}</p>
          </div>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE CASES LIMIT</span>
            <p style={{ fontWeight: 700, marginTop: 4 }}>{user.active_cases} / 5 Max Capacity</p>
          </div>
        </div>

        <button onClick={handleLogout} className="btn btn-outline" style={{ width: '100%' }}>
          <LogOut size={16} /> Sign Out of Staff Portal
        </button>
      </div>
    </div>
  );
}
