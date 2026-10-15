import React, { useState } from 'react';
import { UploadCloud, X, FileText, Image as ImageIcon, AlertTriangle } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];

export default function EvidenceUpload({ files, setFiles }) {
  const [error, setError] = useState('');

  function handleFileSelect(e) {
    setError('');
    const incoming = Array.from(e.target.files || []);

    if (files.length + incoming.length > 5) {
      setError('You can upload a maximum of 5 evidence files per complaint.');
      return;
    }

    const validated = [];
    for (const f of incoming) {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        setError(`"${f.name}" has an unsupported format. Only JPEG, PNG, WEBP, GIF, and PDF are allowed.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`"${f.name}" exceeds the maximum allowed file size of 5MB.`);
        return;
      }

      // Generate local preview URL if image
      const isImg = f.type.startsWith('image/');
      validated.push({
        rawFile: f,
        name: f.name,
        size: (f.size / (1024 * 1024)).toFixed(2) + ' MB',
        previewUrl: isImg ? URL.createObjectURL(f) : null,
        isImage: isImg
      });
    }

    setFiles([...files, ...validated]);
    e.target.value = ''; // Reset input
  }

  function removeFile(index) {
    const target = files[index];
    if (target.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }
    setFiles(files.filter((_, i) => i !== index));
  }

  return (
    <div className="evidence-upload">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label className="form-label" style={{ marginBottom: 0 }}>
          Evidence & Attachments (Optional, max 5 files, 5MB each)
        </label>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {files.length} / 5 selected
        </span>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.85rem', marginBottom: 12 }}>
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--slate-50)',
          cursor: files.length >= 5 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: 16
        }}
      >
        <UploadCloud size={32} color="var(--primary)" style={{ marginBottom: 8 }} />
        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
          Click to upload photos or documents
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
          PNG, JPG, WEBP, or PDF (up to 5MB per file)
        </span>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
          onChange={handleFileSelect}
          disabled={files.length >= 5}
          style={{ display: 'none' }}
        />
      </label>

      {/* File Previews */}
      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {files.map((file, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {file.isImage ? (
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  style={{ width: '100%', height: '90px', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ height: '90px', display: 'grid', placeItems: 'center', background: 'var(--slate-100)' }}>
                  <FileText size={32} color="var(--text-muted)" />
                </div>
              )}
              <div style={{ padding: '6px 8px' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={file.name}>
                  {file.name}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{file.size}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer'
                }}
                title="Remove attachment"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
