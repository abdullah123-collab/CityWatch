import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Compass, AlertCircle } from 'lucide-react';

// Fix default Leaflet icon assets
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function LocationPicker({ location, onChange }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Default coordinate: City Center (e.g. Islamabad/Capital 33.6844, 73.0479 or 0,0)
  const defaultLat = location.latitude || 33.6844;
  const defaultLng = location.longitude || 73.0479;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([defaultLat, defaultLng], {
      draggable: true
    }).addTo(map);
    markerRef.current = marker;

    // Handle marker drag
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      handlePointSelected(pos.lat, pos.lng);
    });

    // Handle map click
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      handlePointSelected(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  async function reverseGeocode(lat, lng) {
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: {
          'Accept-Language': 'en'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const area = addr.suburb || addr.neighbourhood || addr.residential || addr.road || addr.village || 'Municipal Area';
        const city = addr.city || addr.town || addr.municipality || addr.county || 'City Center';
        const district = addr.state_district || addr.state || 'Main District';
        const pincode = addr.postcode || '00000';

        onChange({
          ...location,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          areaName: area,
          city,
          district,
          pincode
        });
      }
    } catch (err) {
      console.warn('Reverse geocoding unavailable:', err.message);
      // Fallback: update coordinates without changing manually typed address
      onChange({
        ...location,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6))
      });
    } finally {
      setGeocoding(false);
    }
  }

  function handlePointSelected(lat, lng) {
    reverseGeocode(lat, lng);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
          markerRef.current.setLatLng([latitude, longitude]);
        }
        handlePointSelected(latitude, longitude);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === 1) {
          setGeoError('Location access was denied. You can still pick a location by clicking on the map or typing the address.');
        } else {
          setGeoError('Unable to detect current location. Please select a point on the map.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  return (
    <div className="location-picker">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="var(--primary)" />
          <strong>Complaint Location</strong>
          {geocoding && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Locating address…)</span>}
        </div>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="btn btn-outline btn-sm"
          disabled={geoLoading}
        >
          <Navigation size={14} />
          {geoLoading ? 'Detecting GPS…' : 'Use My Current Location'}
        </button>
      </div>

      {geoError && (
        <div className="alert alert-info" style={{ padding: '8px 12px', fontSize: '0.85rem', marginBottom: 12 }}>
          <AlertCircle size={15} />
          <span>{geoError}</span>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{
          height: '280px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          marginBottom: 16
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="badge badge-low">
          Lat: {location.latitude ? location.latitude.toFixed(6) : 'Not selected'}
        </span>
        <span className="badge badge-low">
          Lng: {location.longitude ? location.longitude.toFixed(6) : 'Not selected'}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Click or drag marker on map to refine location.
        </span>
      </div>

      {/* Structured Address Fields */}
      <div className="form-grid-2">
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Area / Street / Sector *</label>
          <input
            type="text"
            className="form-control"
            value={location.areaName || ''}
            onChange={(e) => onChange({ ...location, areaName: e.target.value })}
            placeholder="e.g. Sector G-9/1, Street 4"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">City *</label>
          <input
            type="text"
            className="form-control"
            value={location.city || ''}
            onChange={(e) => onChange({ ...location, city: e.target.value })}
            placeholder="e.g. Capital City"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">District *</label>
          <input
            type="text"
            className="form-control"
            value={location.district || ''}
            onChange={(e) => onChange({ ...location, district: e.target.value })}
            placeholder="e.g. Urban District"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Postal Code / Pincode *</label>
          <input
            type="text"
            className="form-control"
            value={location.pincode || ''}
            onChange={(e) => onChange({ ...location, pincode: e.target.value })}
            placeholder="e.g. 44000"
            required
          />
        </div>
      </div>
    </div>
  );
}
