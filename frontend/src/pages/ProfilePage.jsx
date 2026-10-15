import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, ShieldCheck, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="container-narrow" style={{ padding: '50px 24px' }}>
      <div className="card" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: '1.5rem'
            }}
          >
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
              Citizen Profile
            </span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {user.full_name}
            </h1>
            <span className="badge badge-resolved" style={{ marginTop: 4 }}>
              <ShieldCheck size={14} /> Verified Citizen Account
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</span>
            <p style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={16} color="var(--primary)" /> {user.email}
            </p>
          </div>

          <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Phone Number</span>
            <p style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={16} color="var(--primary)" /> {user.phone || 'Not recorded'}
            </p>
          </div>

          <div style={{ padding: 16, background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Registered Address</span>
            <p style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={16} color="var(--primary)" /> {user.address || 'Standard Municipal Jurisdiction'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogOut size={16} /> Sign Out of CityWatch
          </button>
        </div>
      </div>
    </div>
  );
}
