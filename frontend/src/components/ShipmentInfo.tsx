import { useState } from 'react';
import type { ShipmentDetail } from '../types';

interface ShipmentInfoProps {
  shipment: ShipmentDetail;
  onCopyNotice?: (text: string) => void;
}

const statusColors: Record<string, string> = {
  planned: 'badge--status-planned',
  in_transit: 'badge--status-in_transit',
  delivered: 'badge--status-delivered',
  delayed: 'badge--status-delayed',
  cancelled: 'badge--status-cancelled',
};

const locationIcons: Record<string, string> = {
  supplier: '🏭',
  warehouse: '🏢',
  distribution_center: '📦',
  shop: '🏪',
  port: '⚓',
};

export default function ShipmentInfo({ shipment, onCopyNotice }: ShipmentInfoProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(shipment.id);
    setCopied(true);
    onCopyNotice?.(`Copied ${shipment.id} to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportDispatch() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(shipment, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dispatch-${shipment.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Interactive milestone stages
  const isDelivered = shipment.status === 'delivered';
  const isInTransit = shipment.status === 'in_transit' || shipment.status === 'delayed';

  const milestones = [
    { label: 'Created', done: true, active: false },
    { label: 'Dispatched', done: isInTransit || isDelivered, active: shipment.status === 'planned' },
    { label: 'In Transit', done: isDelivered, active: isInTransit },
    { label: 'Delivered', done: isDelivered, active: false },
  ];

  return (
    <div className="sidebar__section animate-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
        <div className="sidebar__section-title" style={{ margin: 0 }}>
          📦 Shipment Overview
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span className={`badge ${statusColors[shipment.status] || ''}`}>
            {shipment.status.replace('_', ' ')}
          </span>
          {shipment.is_demo_data && <span className="badge badge--demo">demo</span>}
        </div>
      </div>

      <div
        style={{
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* ID & Quick Copy */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Tracking ID</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', fontWeight: 600 }}>
              {shipment.id}
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ padding: '1px 6px', fontSize: '10px' }}
              onClick={handleCopy}
              title="Copy tracking ID"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
        </div>

        {/* Milestone Lifecycle Steps */}
        <div style={{ margin: 'var(--space-sm) 0 var(--space-md)', padding: '10px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            {/* Connecting line */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '16px',
                right: '16px',
                height: '2px',
                background: 'var(--color-border)',
                zIndex: 0,
              }}
            />
            {milestones.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, minWidth: '48px' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: m.done ? 'var(--color-risk-low)' : m.active ? 'var(--color-accent)' : 'var(--color-bg-card)',
                    border: `2px solid ${m.done ? 'var(--color-risk-low)' : m.active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#fff',
                    marginBottom: '4px',
                    boxShadow: m.active ? '0 0 8px var(--color-accent)' : undefined,
                  }}
                >
                  {m.done ? '✓' : idx + 1}
                </div>
                <div style={{ fontSize: '9px', color: m.done || m.active ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: m.active ? 600 : 400 }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Origin */}
        <div style={{ marginBottom: 'var(--space-xs)' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Origin Hub</div>
          <div style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span>{locationIcons[shipment.origin.type] || '📍'}</span>
            <span>{shipment.origin.name}</span>
          </div>
          {shipment.origin.address && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingLeft: '22px' }}>
              {shipment.origin.address}
            </div>
          )}
        </div>

        {/* Route Direction Connector */}
        <div style={{ paddingLeft: '24px', margin: '2px 0', color: 'var(--color-text-muted)', fontSize: '12px' }}>
          ↓ <span style={{ fontSize: '10px', color: 'var(--color-accent)' }}>Corridor In-Transit</span>
        </div>

        {/* Destination */}
        <div style={{ marginBottom: 'var(--space-sm)' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Destination Hub</div>
          <div style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span>{locationIcons[shipment.destination.type] || '🏁'}</span>
            <span>{shipment.destination.name}</span>
          </div>
          {shipment.destination.address && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingLeft: '22px' }}>
              {shipment.destination.address}
            </div>
          )}
        </div>

        {/* Cargo Specification Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-sm)',
            paddingTop: 'var(--space-sm)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Cargo Category</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              📦 {shipment.cargo_type?.replace('_', ' ') || 'General Freight'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Gross Weight</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              ⚖️ {shipment.weight_kg > 0 ? `${shipment.weight_kg.toLocaleString()} kg` : 'N/A'}
            </div>
          </div>
          {shipment.planned_delivery && (
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Planned Delivery Schedule</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                🕐 {new Date(shipment.planned_delivery).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Quick Export Button */}
        <div style={{ marginTop: 'var(--space-sm)', paddingTop: 'var(--space-xs)' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            style={{ width: '100%', fontSize: '11px' }}
            onClick={handleExportDispatch}
          >
            💾 Export Dispatch Manifest (JSON)
          </button>
        </div>
      </div>
    </div>
  );
}
