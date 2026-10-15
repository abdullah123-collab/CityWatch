import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStaffAuth } from '../context/StaffAuthContext';
import { Shield, User, LogOut, CheckSquare } from 'lucide-react';

export default function StaffNavbar() {
  const { user, logout } = useStaffAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <Shield size={22} color="var(--primary)" />
          <span>CityWatch</span>
          <span className="brand-badge">Field Staff</span>
        </Link>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700 }}>{user.full_name}</div>
              <span style={{ color: 'var(--text-muted)' }}>{user.designation} • {user.dept_name}</span>
            </div>
            <Link to="/profile" className="btn btn-outline btn-sm">
              <User size={15} />
            </Link>
            <button onClick={handleLogout} className="btn btn-outline btn-sm" title="Sign Out">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
