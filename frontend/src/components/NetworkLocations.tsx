import { useState, useMemo } from 'react';
import type { SupplyChainLink, Location } from '../types';

interface NetworkLocationsProps {
  locations: Location[];
  links: SupplyChainLink[];
  isDemoData: boolean;
  onLocationClick?: (loc: Location) => void;
}

const locationIcons: Record<string, string> = {
  supplier: '🏭',
  warehouse: '🏢',
  distribution_center: '📦',
  shop: '🏪',
  port: '⚓',
};

const locationTypeLabels: Record<string, string> = {
  supplier: 'Supplier',
  warehouse: 'Warehouse',
  distribution_center: 'Distribution Center',
  shop: 'Retail Shop',
  port: 'Port Hub',
};

export default function NetworkLocations({
  locations,
  links,
  isDemoData,
  onLocationClick,
}: NetworkLocationsProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const filteredLocations = useMemo(() => {
    if (filterType === 'all') return locations;
    return locations.filter((l) => l.type === filterType);
  }, [locations, filterType]);

  if (!locations || locations.length === 0) {
    return null;
  }

  // Get unique node types for filter
  const nodeTypes = Array.from(new Set(locations.map((l) => l.type)));

  function handleNodeClick(loc: Location) {
    setSelectedNodeId(loc.id);
    onLocationClick?.(loc);
  }

  return (
    <div className="sidebar__section animate-slide-in">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-xs)',
        }}
      >
        <div className="sidebar__section-title" style={{ margin: 0 }}>
          🕸️ Supply Chain Graph ({locations.length} Nodes)
        </div>
        {isDemoData && <span className="badge badge--demo">neo4j graph</span>}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
        Interactive graph topology of upstream suppliers, transit warehouses, and endpoints.
      </div>

      {/* Filter by Entity Type */}
      {nodeTypes.length > 1 && (
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '2px' }}>
          <button
            type="button"
            className={`btn btn--sm ${filterType === 'all' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '10px', padding: '2px 6px' }}
            onClick={() => setFilterType('all')}
          >
            All ({locations.length})
          </button>
          {nodeTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`btn btn--sm ${filterType === type ? 'btn--primary' : 'btn--secondary'}`}
              style={{ fontSize: '10px', padding: '2px 6px', whiteSpace: 'nowrap' }}
              onClick={() => setFilterType(type)}
            >
              {locationIcons[type]} {locationTypeLabels[type] || type}
            </button>
          ))}
        </div>
      )}

      {/* Network nodes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
        {filteredLocations.map((loc) => {
          const isSelected = loc.id === selectedNodeId;
          return (
            <div
              key={loc.id}
              onClick={() => handleNodeClick(loc)}
              className={`card card--clickable ${isSelected ? 'card--selected' : ''}`}
              style={{
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleNodeClick(loc);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{locationIcons[loc.type] || '📍'}</span>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{loc.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {locationTypeLabels[loc.type] || loc.type}
                    {loc.address ? ` · ${loc.address}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--color-accent)',
                  }}
                >
                  {loc.id}
                </span>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  {loc.coordinates.lat.toFixed(2)}, {loc.coordinates.lon.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Graph relations if any */}
      {links && links.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
            🔗 Active Graph Relations ({links.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {links.map((link, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <span>{locationIcons[link.source.type] || '📍'} <strong>{link.source.name}</strong></span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: '10px' }}>
                  —[{link.relationship}]→
                </span>
                <span>{locationIcons[link.target.type] || '📍'} <strong>{link.target.name}</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
