import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, Clock, RefreshCw, X, AlertCircle } from 'lucide-react';

export default function GoogleLoginModal({ isOpen, onClose }) {
  const { googleInitiate, googleVerifyOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('token'); // 'token' -> 'otp'
  const [idTokenInput, setIdTokenInput] = useState('');
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [googleUserName, setGoogleUserName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Timers
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [cooldown, setCooldown] = useState(60); // 60 seconds

  useEffect(() => {
    let timer;
    if (step === 'otp' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  useEffect(() => {
    let timer;
    if (step === 'otp' && cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, cooldown]);

  if (!isOpen) return null;

  async function handleInitiate(e) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setBusy(true);

    try {
      const result = await googleInitiate(idTokenInput);
      setGoogleUserEmail(result.email);
      setGoogleUserName(result.name || '');
      setStatusMsg(result.message);
      setStep('otp');
      setTimeLeft(300);
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      await googleVerifyOtp(googleUserEmail, otpCode, googleUserName);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0) return;
    setError('');
    setBusy(true);

    try {
      const result = await googleInitiate(idTokenInput);
      setStatusMsg(`A new code was sent to ${googleUserEmail}.`);
      setTimeLeft(300);
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)'
          }}
        >
          <X size={20} />
        </button>

        {step === 'token' ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px'
                }}
              >
                <ShieldCheck size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sign in with Google</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Two-Factor Security: Google Identity Token followed by verified Email OTP.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ fontSize: '0.88rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitiate}>
              <div className="form-group">
                <label className="form-label">Google Identity Token (JWT)</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={idTokenInput}
                  onChange={(e) => setIdTokenInput(e.target.value)}
                  placeholder="Paste your verified Google ID Token from Google Sign-In"
                  required
                  style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                  The backend verifies this token with Google's public keys, validates audience and verified email, then dispatches an OTP.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary full"
                style={{ width: '100%', marginTop: 8 }}
                disabled={busy}
              >
                {busy ? 'Verifying with Google…' : 'Verify Identity & Send Email OTP'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--info-bg)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px'
                }}
              >
                <Mail size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Enter Verification Code</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
                We sent a 6-digit one-time code to: <br />
                <strong style={{ color: 'var(--text-main)' }}>{googleUserEmail}</strong>
              </p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ fontSize: '0.88rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {statusMsg && !error && (
              <div className="alert alert-info" style={{ fontSize: '0.85rem' }}>
                <span>{statusMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" style={{ marginBottom: 10 }}>
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-control"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  style={{
                    fontSize: '2rem',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontWeight: 800,
                    maxWidth: '240px',
                    margin: '0 auto'
                  }}
                  autoFocus
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: 20
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={15} /> Code expires in: <strong>{formatTime(timeLeft)}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0 || busy}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? 'var(--text-light)' : 'var(--primary)',
                    fontWeight: 600,
                    cursor: cooldown > 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={busy || otpCode.length !== 6 || timeLeft === 0}
              >
                {busy ? 'Validating Code…' : 'Verify & Enter Dashboard'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
