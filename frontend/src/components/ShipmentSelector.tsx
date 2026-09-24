import React, { useCallback, useEffect, useState, useMemo } from 'react';
import type { Coordinates, ShipmentDetail, ShipmentSummary } from '../types';
import { getShipments, getShipment } from '../services/api';

interface ShipmentSelectorProps {
  onShipmentSelect: (shipment: ShipmentDetail) => void;
  onManualRoute: (origin: Coordinates, destination: Coordinates) => void;
  selectedShipmentId?: string;
  onModeChange?: (mode: 'shipment' | 'manual') => void;
  manualOriginCoords?: Coordinates | null;
  manualDestCoords?: Coordinates | null;
}

const PRESET_CORRIDORS = [
  {
    name: 'Mumbai ➔ Delhi (NH48)',
    origin: { lat: 19.076, lon: 72.8777 },
    dest: { lat: 28.6139, lon: 77.209 },
  },
  {
    name: 'Bengaluru ➔ Chennai',
    origin: { lat: 12.9716, lon: 77.5946 },
    dest: { lat: 13.0827, lon: 80.2707 },
  },
  {
    name: 'Kolkata ➔ Patna (East Corridor)',
    origin: { lat: 22.5726, lon: 88.3639 },
    dest: { lat: 25.5941, lon: 85.1376 },
  },
  {
    name: 'Pune ➔ Ahmedabad',
    origin: { lat: 18.5204, lon: 73.8567 },
    dest: { lat: 23.0225, lon: 72.5714 },
  },
];

export default function ShipmentSelector({
  onShipmentSelect,
  onManualRoute,
  selectedShipmentId,
  onModeChange,
  manualOriginCoords,
  manualDestCoords,
}: ShipmentSelectorProps) {
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'shipment' | 'manual'>('shipment');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'id' | 'status'>('default');

  // Manual mode inputs
  const [originLat, setOriginLat] = useState('19.0760');
  const [originLon, setOriginLon] = useState('72.8777');
  const [destLat, setDestLat] = useState('28.6139');
  const [destLon, setDestLon] = useState('77.2090');

  // Synchronize map clicked coordinates into inputs
  useEffect(() => {
    if (manualOriginCoords) {
      setOriginLat(manualOriginCoords.lat.toString());
      setOriginLon(manualOriginCoords.lon.toString());
    }
  }, [manualOriginCoords]);

  useEffect(() => {
    if (manualDestCoords) {
      setDestLat(manualDestCoords.lat.toString());
      setDestLon(manualDestCoords.lon.toString());
    }
  }, [manualDestCoords]);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getShipments(1, 30, statusFilter || undefined);
      setShipments(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  function handleModeSwitch(newMode: 'shipment' | 'manual') {
    setMode(newMode);
    onModeChange?.(newMode);
  }

  async function handleShipmentClick(id: string) {
    try {
      const detail = await getShipment(id);
      onShipmentSelect(detail);
    } catch (err: any) {
      setError(err.message || 'Failed to load shipment details');
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const oLat = parseFloat(originLat);
    const oLon = parseFloat(originLon);
    const dLat = parseFloat(destLat);
    const dLon = parseFloat(destLon);

    if ([oLat, oLon, dLat, dLon].some(isNaN)) {
      setError('Please enter valid numerical coordinates');
      return;
    }

    if (oLat < -90 || oLat > 90 || dLat < -90 || dLat > 90) {
      setError('Latitude must be between -90 and 90');
      return;
    }

    if (oLon < -180 || oLon > 180 || dLon < -180 || dLon > 180) {
      setError('Longitude must be between -180 and 180');
      return;
    }

    setError(null);
    onManualRoute({ lat: oLat, lon: oLon }, { lat: dLat, lon: dLon });
  }

  function handlePresetSelect(preset: (typeof PRESET_CORRIDORS)[0]) {
    setOriginLat(preset.origin.lat.toString());
    setOriginLon(preset.origin.lon.toString());
    setDestLat(preset.dest.lat.toString());
    setDestLon(preset.dest.lon.toString());
    onManualRoute(preset.origin, preset.dest);
  }

  // Filtered and sorted shipments
  const filteredShipments = useMemo(() => {
    let list = shipments;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.origin_name.toLowerCase().includes(q) ||
          s.destination_name.toLowerCase().includes(q) ||
          s.cargo_type?.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'id') {
      list = [...list].sort((a, b) => a.id.localeCompare(b.id));
    } else if (sortBy === 'status') {
      list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    }

    return list;
  }, [shipments, searchQuery, sortBy]);

  const statusColors: Record<string, string> = {
    planned: 'badge--status-planned',
    in_transit: 'badge--status-in_transit',
    delivered: 'badge--status-delivered',
    delayed: 'badge--status-delayed',
    cancelled: 'badge--status-cancelled',
  };

  return (
    <>
      {/* Mode Switcher */}
      <div className="sidebar__section" style={{ paddingBottom: 'var(--space-xs)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            className={`btn btn--sm ${mode === 'shipment' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontWeight: 600 }}
            onClick={() => handleModeSwitch('shipment')}
          >
            📦 Active Shipments
          </button>
          <button
            type="button"
            className={`btn btn--sm ${mode === 'manual' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontWeight: 600 }}
            onClick={() => handleModeSwitch('manual')}
          >
            📍 Custom Route
          </button>
        </div>
      </div>

      {mode === 'shipment' ? (
        <>
          {/* Quick Search & Filter Controls */}
          <div className="sidebar__section" style={{ paddingTop: 0 }}>
            {/* Live Search Bar */}
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input
                type="text"
                className="input"
                placeholder="🔍 Search ID, city, cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', fontSize: 'var(--text-xs)', padding: '6px 10px' }}
                aria-label="Search shipments"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: '', label: 'All' },
                { id: 'in_transit', label: 'In Transit' },
                { id: 'delayed', label: 'Delayed' },
                { id: 'planned', label: 'Planned' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`btn btn--sm ${statusFilter === chip.id ? 'btn--primary' : 'btn--secondary'}`}
                  style={{ fontSize: '11px', padding: '2px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setStatusFilter(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shipment List */}
          <div style={{ padding: '0 var(--space-md) var(--space-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {filteredShipments.length} {filteredShipments.length === 1 ? 'shipment' : 'shipments'} found
              </span>
              <select
                className="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{ fontSize: '10px', padding: '2px 6px', width: 'auto' }}
                aria-label="Sort shipments"
              >
                <option value="default">Sort: Default</option>
                <option value="id">Sort: ID</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>
          </div>

          <div className="sidebar__scroll" style={{ maxHeight: '380px' }}>
            {loading && (
              <div className="loading-spinner">
                <div className="loading-spinner__ring" />
              </div>
            )}

            {error && (
              <div className="error-state">
                <div className="error-state__message">⚠️ {error}</div>
                <button type="button" className="btn btn--sm btn--secondary" onClick={loadShipments}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filteredShipments.length === 0 && (
              <div className="empty-state">
                <div className="empty-state__icon">📦</div>
                <div className="empty-state__title">No shipments found</div>
                <div className="empty-state__text">
                  {searchQuery || statusFilter ? 'Try clearing search or filters' : 'No shipments available'}
                </div>
              </div>
            )}

            {filteredShipments.map((s, idx) => (
              <div
                key={s.id}
                className={`card card--clickable ${s.id === selectedShipmentId ? 'card--selected' : ''}`}
                style={{
                  margin: '0 var(--space-md) var(--space-sm)',
                  animationDelay: `${idx * 40}ms`,
                }}
                onClick={() => handleShipmentClick(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleShipmentClick(s.id);
                }}
                aria-label={`Shipment ${s.id} from ${s.origin_name} to ${s.destination_name}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600 }}>
                    {s.id}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span className={`badge ${statusColors[s.status] || ''}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                    {s.is_demo_data && <span className="badge badge--demo">demo</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  <span>{s.origin_name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>➔</span>
                  <span>{s.destination_name}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span>📦 {s.cargo_type?.replace('_', ' ') || 'General'}</span>
                  {s.planned_delivery && <span>🕐 {new Date(s.planned_delivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Manual Route Planning Mode */
        <div className="sidebar__section">
          {/* Quick Preset Corridors */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              ⚡ Quick Route Presets (1-Click Test)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
              {PRESET_CORRIDORS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ textAlign: 'left', fontSize: '11px', padding: '6px 8px' }}
                  onClick={() => handlePresetSelect(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-accent)', marginBottom: 'var(--space-sm)', background: 'rgba(59, 130, 246, 0.08)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
            💡 <strong>Interactive Map:</strong> You can also click directly on the map to place Origin 🟢 and Destination 🔴 pins!
          </div>

          <form onSubmit={handleManualSubmit}>
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-risk-low)', marginBottom: '4px' }}>
                🟢 Origin Coordinates
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="Lat"
                  value={originLat}
                  onChange={(e) => setOriginLat(e.target.value)}
                  required
                />
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="Lon"
                  value={originLon}
                  onChange={(e) => setOriginLon(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-risk-high)', marginBottom: '4px' }}>
                🔴 Destination Coordinates
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="Lat"
                  value={destLat}
                  onChange={(e) => setDestLat(e.target.value)}
                  required
                />
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="Lon"
                  value={destLon}
                  onChange={(e) => setDestLon(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn--primary" style={{ width: '100%', fontWeight: 600 }}>
              🚀 Calculate & Compare Routes
            </button>
          </form>
        </div>
      )}
    </>
  );
}
