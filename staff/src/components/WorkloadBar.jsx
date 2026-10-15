import React from 'react';
import { Briefcase, AlertTriangle } from 'lucide-react';

export default function WorkloadBar({ activeCases = 0, maxCapacity = 5 }) {
  const percentage = Math.min(100, Math.round((activeCases / maxCapacity) * 100));

  let color = '#16a34a'; // green
  if (activeCases >= 4) color = '#dc2626'; // red
  else if (activeCases >= 3) color = '#d97706'; // amber

  return (
    <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={18} color="var(--primary)" />
          <strong style={{ fontSize: '0.95rem' }}>Current Workload & Case Capacity</strong>
        </div>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color }}>
          {activeCases} / {maxCapacity} Active Cases ({percentage}%)
        </span>
      </div>

      <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease'
          }}
        />
      </div>

      {activeCases >= maxCapacity && (
        <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0, padding: '8px 12px', fontSize: '0.85rem' }}>
          <AlertTriangle size={15} />
          <span>You have reached the maximum active case capacity (5). Resolve pending complaints to receive new assignments.</span>
        </div>
      )}
    </div>
  );
}
