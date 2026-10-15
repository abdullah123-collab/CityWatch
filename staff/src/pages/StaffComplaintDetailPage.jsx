import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import L from 'leaflet';
import StatusUpdateModal from '../components/StatusUpdateModal';
import { ArrowLeft, MapPin, User, Paperclip, Calendar, CheckSquare, AlertCircle } from 'lucide-react';

export default function StaffComplaintDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  function loadDetails() {
    setLoading(true);
    fetch(`/api/complaints/${id}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Complaint not found or access denied.');
        return r.json();
      })
      .then((resData) => setData(resData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetails();
  }, [id]);

  useEffect(() => {
    if (!data || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const lat = data.complaint.latitude || 33.6844;
    const lng = data.complaint.longitude || 73.0479;

    const map = L.map(mapContainerRef.current).setView([lat, lng], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<b>#${data.complaint.complaint_id}: ${data.complaint.title}</b><br/>${data.complaint.area_name}`)
      .openPopup();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading case records from SQL Server…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container" style={{ padding: '40px 24px', maxWidth: '640px' }}>
        <div className="alert alert-danger">{error || 'Case could not be loaded.'}</div>
        <Link to="/" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const { complaint, attachments, history } = data;

  return (
    <div className="container" style={{ padding: '36px 24px', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Link to="/" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn btn-primary btn-sm"
        >
          <CheckSquare size={16} /> Update Case Status
        </button>
      </div>

      {/* HEADER CARD */}
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
              Case #{complaint.complaint_id}
            </span>
            <span className={`badge badge-${complaint.status.toLowerCase().replace(/\s+/g, '-')}`}>
              {complaint.status}
            </span>
            <span className={`badge badge-${complaint.priority ? complaint.priority.toLowerCase() : 'medium'}`}>
              {complaint.priority} Priority
            </span>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Logged: {new Date(complaint.submitted_at).toLocaleString()}
          </span>
        </div>

        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
          {complaint.title}
        </h1>

        <p style={{ fontSize: '0.98rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {complaint.description}
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

        {/* CITIZEN & JURISDICTION INFO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Reporting Citizen
            </span>
            <p style={{ fontWeight: 700, marginTop: 4 }}>{complaint.citizen_name}</p>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tel: {complaint.citizen_phone || 'None'} • {complaint.citizen_email}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Department
            </span>
            <p style={{ fontWeight: 700, marginTop: 4 }}>{complaint.department}</p>
          </div>

          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Location Address
            </span>
            <p style={{ fontWeight: 700, marginTop: 4 }}>
              {[complaint.area_name, complaint.city, complaint.district, complaint.pincode].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* LEFT COLUMN: MAP & ATTACHMENTS */}
        <div>
          <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={17} color="var(--primary)" /> Incident Coordinates
            </h3>
            <div
              ref={mapContainerRef}
              style={{
                height: '240px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                marginBottom: 10
              }}
            />
            {complaint.latitude && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                GPS: {complaint.latitude.toFixed(6)}, {complaint.longitude.toFixed(6)}
              </span>
            )}
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Paperclip size={17} color="var(--primary)" /> Evidence Attachments ({attachments.length})
            </h3>
            {attachments.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No attachments submitted.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {attachments.map((att) => {
                  const isImage = att.mime_type.startsWith('image/');
                  const streamUrl = `/api/complaints/${complaint.complaint_id}/attachments/${att.attachment_id}`;
                  return (
                    <a
                      key={att.attachment_id}
                      href={streamUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block'
                      }}
                    >
                      {isImage ? (
                        <img src={streamUrl} alt={att.file_name} style={{ width: '100%', height: '75px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: '75px', display: 'grid', placeItems: 'center', background: '#f1f5f9' }}>
                          <Paperclip size={24} color="#64748b" />
                        </div>
                      )}
                      <div style={{ padding: '4px 6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.file_name}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: STATUS HISTORY */}
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>
              Investigation & Action Timeline
            </h3>

            {history.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No history entries logged.</p>
            ) : (
              <div className="timeline">
                {history.map((h) => (
                  <div key={h.history_id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-header">
                      <span className="timeline-title">{h.new_status}</span>
                      <span className="timeline-time">{new Date(h.changed_at).toLocaleString()}</span>
                    </div>
                    {h.remarks && <div className="timeline-body">{h.remarks}</div>}
                    {h.staff_name && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Recorded by: {h.staff_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusUpdateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        complaint={complaint}
        onSuccess={loadDetails}
      />
    </div>
  );
}
