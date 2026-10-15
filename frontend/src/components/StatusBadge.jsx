import React from 'react';

export default function StatusBadge({ status }) {
  const norm = String(status || '').toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`badge badge-${norm}`}>
      <span style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: 'currentColor'
      }} />
      {status || 'Pending'}
    </span>
  );
}
