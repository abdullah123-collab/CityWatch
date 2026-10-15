import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, CheckCircle2, Clock, Users, ArrowRight, Building2, Flame, Wrench, Droplet, Zap } from 'lucide-react';

export default function LandingPage() {
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDepartments(data))
      .catch(() => setDepartments([]))
      .finally(() => setDeptLoading(false));
  }, []);

  return (
    <div className="landing-page">
      {/* HERO SECTION */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          color: '#ffffff',
          padding: '80px 0 90px',
          textAlign: 'center'
        }}
      >
        <div className="container-narrow">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 9999,
              background: 'rgba(255, 255, 255, 0.12)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: 20
            }}
          >
            <ShieldCheck size={16} color="#60a5fa" />
            <span>Official Municipal Civic Grievance System</span>
          </div>

          <h1
            style={{
              fontSize: '3.2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: 20
            }}
          >
            Report an issue.<br />
            <span style={{ color: '#93c5fd' }}>See real progress.</span>
          </h1>

          <p
            style={{
              fontSize: '1.2rem',
              color: '#cbd5e1',
              maxWidth: '650px',
              margin: '0 auto 36px',
              lineHeight: 1.6
            }}
          >
            CityWatch directly connects residents with municipal departments. Pinpoint issues on a map, attach evidence, and track every stage until resolution.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1.05rem', backgroundColor: '#2563eb' }}>
              Create Resident Account <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-outline" style={{ padding: '14px 28px', fontSize: '1.05rem', backgroundColor: 'transparent', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }}>
              Sign In to Track Reports
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '70px 0', backgroundColor: '#ffffff', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transparent Governance
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 4 }}>How CityWatch Works</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
            <div className="card" style={{ padding: 32, marginBottom: 0 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  marginBottom: 20
                }}
              >
                01
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 10 }}>Submit with Evidence</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Select the category, pinpoint the GPS location on OpenStreetMap, and attach photos or supporting documents directly from your device.
              </p>
            </div>

            <div className="card" style={{ padding: 32, marginBottom: 0 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  marginBottom: 20
                }}
              >
                02
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 10 }}>Automated Routing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Your complaint is immediately logged into Microsoft SQL Server and routed to authorized municipal inspectors based on department and area jurisdiction.
              </p>
            </div>

            <div className="card" style={{ padding: 32, marginBottom: 0 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  marginBottom: 20
                }}
              >
                03
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 10 }}>Resolution & Feedback</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Follow real-time status transitions on your timeline. Once marked resolved with inspector remarks, rate your service satisfaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DEPARTMENTS SHOWCASE */}
      <section style={{ padding: '70px 0', backgroundColor: 'var(--bg-page)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Connected Municipal Services
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 4 }}>Responsible Departments</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {departments.map((dept) => (
              <div key={dept.dept_id} className="card" style={{ marginBottom: 0, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius)',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                  >
                    <Building2 size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '1.05rem' }}>{dept.dept_name}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dept.category}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: 8 }}>
                  <p><strong>Head Officer:</strong> {dept.head_officer || 'Municipal Officer'}</p>
                  <p style={{ marginTop: 4 }}><strong>Helpline:</strong> {dept.contact_phone || 'Call 311'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
