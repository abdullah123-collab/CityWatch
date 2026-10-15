import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: '80px 24px', maxWidth: '460px' }}>
      <div className="card" style={{ padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 14px'
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--primary)' }}>
            CityWatch Command Center
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
            Administrator Authentication Portal
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: '0.88rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Administrator Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@citywatch.gov"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Master Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter administrator password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '0.98rem', marginTop: 6 }}
            disabled={busy}
          >
            <Lock size={16} />
            {busy ? 'Authenticating…' : 'Access Administrator Console'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          CityWatch Administrative System • SQL Server Enterprise Integration
        </div>
      </div>
    </div>
  );
}
