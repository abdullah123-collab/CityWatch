import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import L from 'leaflet';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, MapPin, Calendar, Building2, User, Paperclip, Star, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

export default function ComplaintDetailsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Feedback state
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  function loadDetails() {
    setLoading(true);
    fetch(`/api/complaints/${id}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Complaint not found or access denied.');
        return res.json();
      })
      .then((resData) => setData(resData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetails();
  }, [id]);

  // Leaflet map initialization
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

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    setFeedbackError('');
    setFeedbackSuccess('');
    setFeedbackBusy(true);

    try {
      const res = await fetch(`/api/complaints/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, comments })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to submit feedback.');
      setFeedbackSuccess('Thank you! Your feedback has been recorded.');
      loadDetails();
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setFeedbackBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading complaint records from SQL Server…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container" style={{ padding: '40px 24px', maxWidth: '640px' }}>
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error || 'Complaint record could not be loaded.'}</span>
        </div>
        <Link to="/complaints" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} /> Back to My Complaints
        </Link>
      </div>
    );
  }

  const { complaint, attachments, history, feedback } = data;

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      <Link to="/complaints" className="btn btn-outline btn-sm" style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back to My Complaints
      </Link>

      {/* HEADER CARD */}
      <div className="card" style={{ padding: '32px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
              #{complaint.complaint_id}
            </span>
            <StatusBadge status={complaint.status} />
            <span className={`badge badge-${complaint.priority ? complaint.priority.toLowerCase() : 'medium'}`}>
              {complaint.priority} Priority
            </span>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Submitted on {new Date(complaint.submitted_at).toLocaleString()}
          </span>
        </div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 14 }}>
          {complaint.title}
        </h1>

        <p style={{ fontSize: '1rem', color: 'var(--slate-700)', lineHeight: 1.6, whiteHeight: 'pre-wrap' }}>
          {complaint.description}
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

        {/* METADATA GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Department
            </span>
            <p style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={16} color="var(--primary)" />
              {complaint.department}
            </p>
          </div>

          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Assigned Officer
            </span>
            <p style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={16} color="var(--primary)" />
              {complaint.assigned_staff || 'Pending Assignment'}
            </p>
          </div>

          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Area Jurisdiction
            </span>
            <p style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={16} color="var(--primary)" />
              {[complaint.area_name, complaint.city].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* LEFT COLUMN: LOCATION & ATTACHMENTS */}
        <div>
          {/* MAP */}
          <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} color="var(--primary)" /> Pinpointed Location
            </h3>
            <div
              ref={mapContainerRef}
              style={{
                height: '240px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                marginBottom: 12
              }}
            />
            <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 600 }}>
              {[complaint.area_name, complaint.city, complaint.district, complaint.pincode].filter(Boolean).join(', ')}
            </p>
            {complaint.latitude && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Coordinates: {complaint.latitude.toFixed(6)}, {complaint.longitude.toFixed(6)}
              </span>
            )}
          </div>

          {/* ATTACHMENTS */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Paperclip size={18} color="var(--primary)" /> Supporting Evidence ({attachments.length})
            </h3>

            {attachments.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No attachments uploaded for this complaint.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
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
                        <img
                          src={streamUrl}
                          alt={att.file_name}
                          style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ height: '80px', display: 'grid', placeItems: 'center', background: 'var(--slate-100)' }}>
                          <Paperclip size={24} color="var(--text-muted)" />
                        </div>
                      )}
                      <div style={{ padding: '6px 8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.file_name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {(att.file_size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TIMELINE HISTORY & FEEDBACK */}
        <div>
          {/* TIMELINE */}
          <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>
              Status History Timeline
            </h3>

            {history.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No status history recorded yet.</p>
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
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Updated by: {h.staff_name} ({h.staff_designation || 'Officer'})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CITIZEN SATISFACTION FEEDBACK */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={18} color="#eab308" /> Citizen Feedback & Review
            </h3>

            {feedback && feedback.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {feedback.map((fb) => (
                  <div key={fb.feedback_id} style={{ padding: '14px', background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#eab308', marginBottom: 6 }}>
                      {'★'.repeat(fb.rating)}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 6 }}>
                        ({fb.rating} / 5 stars) • {new Date(fb.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                    {fb.comments && (
                      <p style={{ fontSize: '0.9rem', color: 'var(--slate-700)', fontStyle: 'italic' }}>
                        "{fb.comments}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  How satisfied are you with the municipal response? Share your rating to help us improve service quality.
                </p>

                {feedbackSuccess && (
                  <div className="alert alert-success" style={{ fontSize: '0.85rem' }}>
                    <CheckCircle size={16} />
                    <span>{feedbackSuccess}</span>
                  </div>
                )}
                {feedbackError && (
                  <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
                    <AlertCircle size={16} />
                    <span>{feedbackError}</span>
                  </div>
                )}

                <form onSubmit={handleFeedbackSubmit}>
                  <div className="form-group">
                    <label className="form-label">Service Rating</label>
                    <select
                      className="form-control"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                    >
                      <option value={5}>★★★★★ 5 - Excellent (Prompt & Effective)</option>
                      <option value={4}>★★★★☆ 4 - Good (Satisfactory)</option>
                      <option value={3}>★★★☆☆ 3 - Average</option>
                      <option value={2}>★★☆☆☆ 2 - Below Expectations</option>
                      <option value={1}>★☆☆☆☆ 1 - Poor (Unresolved)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Comments or Suggestions</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Share your experience regarding communication, speed, or resolution quality."
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={feedbackBusy}
                  >
                    {feedbackBusy ? 'Submitting…' : 'Submit Review'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
