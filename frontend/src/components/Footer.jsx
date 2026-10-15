import React from 'react';
import { ShieldAlert, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="var(--primary)" />
          <strong>CityWatch Civic Services</strong>
          <span>— Empowering accountable urban governance.</span>
        </div>
        <div>
          <span>© {new Date().getFullYear()} Municipal Citizen Portal. Integrated with SQL Server.</span>
        </div>
      </div>
    </footer>
  );
}
