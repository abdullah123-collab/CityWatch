import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker';
import EvidenceUpload from '../components/EvidenceUpload';
import { PlusCircle, AlertCircle, ArrowLeft, Send } from 'lucide-react';

export default function NewComplaintPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');

  const [location, setLocation] = useState({
    areaName: '',
    city: '',
    district: '',
    pincode: '',
    latitude: 33.6844,
    longitude: 73.0479
  });

  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setDepartments(data);
        if (data.length > 0) {
          setSelectedDeptId(String(data[0].dept_id));
          setCategory(data[0].category);
        }
      })
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  function handleDeptChange(e) {
    const deptId = e.target.value;
    setSelectedDeptId(deptId);
    const found = departments.find((d) => String(d.dept_id) === String(deptId));
    if (found) {
      setCategory(found.category);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a complaint title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a detailed description of the issue.');
      return;
    }
    if (!location.areaName || !location.city) {
      setError('Please verify the location area and city.');
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('departmentId', selectedDeptId);
      formData.append('title', title.trim());
      formData.append('category', category.trim() || 'General Civic');
      formData.append('priority', priority);
      formData.append('description', description.trim());
      formData.append('location', JSON.stringify(location));

      // Append raw files
      files.forEach((f) => {
        formData.append('attachments', f.rawFile);
      });

      const res = await fetch('/api/complaints', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint.');
      }

      navigate(`/complaints/${data.complaintId}`);
    } catch (err) {
      setError(err.message || 'Error occurred while saving complaint.');
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '880px' }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="btn btn-outline btn-sm"
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card" style={{ padding: '36px' }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            New Civic Report
          </span>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
            Tell Us What Needs Municipal Attention
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 4 }}>
            Provide clear details, pin the exact coordinates on the map, and attach photos to expedite resolution.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* DEPARTMENT & CATEGORY */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Responsible Department *</label>
              <select
                className="form-control"
                value={selectedDeptId}
                onChange={handleDeptChange}
                required
              >
                {departments.map((d) => (
                  <option key={d.dept_id} value={d.dept_id}>
                    {d.dept_name} ({d.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <input
                type="text"
                className="form-control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Road Maintenance, Garbage Collection"
                required
              />
            </div>
          </div>

          {/* TITLE & PRIORITY */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Complaint Title *</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Broken water pipeline flooding street"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Urgency / Priority *</label>
              <select
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Low">Low — Minor nuisance</option>
                <option value="Medium">Medium — Standard civic concern</option>
                <option value="High">High — Hazardous or severe impairment</option>
                <option value="Critical">Critical — Immediate public safety risk</option>
              </select>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="form-group">
            <label className="form-label">Detailed Description *</label>
            <textarea
              className="form-control"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what occurred, any landmarks, duration of the issue, and specific impact on the neighborhood."
              required
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

          {/* INTERACTIVE LEAFLET MAP & LOCATION */}
          <LocationPicker location={location} onChange={setLocation} />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

          {/* EVIDENCE UPLOAD */}
          <EvidenceUpload files={files} setFiles={setFiles} />

          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn btn-outline"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '1rem' }}
              disabled={busy}
            >
              <Send size={16} />
              {busy ? 'Submitting to SQL Server…' : 'Submit Civic Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
