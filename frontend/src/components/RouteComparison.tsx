import type { RouteCandidate } from '../types';

interface RouteComparisonProps {
  routes: RouteCandidate[];
  selectedRouteId?: string;
  onRouteSelect: (routeId: string) => void;
}

const ROUTE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4'];

export default function RouteComparison({
  routes,
  selectedRouteId,
  onRouteSelect,
}: RouteComparisonProps) {
  if (routes.length === 0) return null;

  // Find best candidates
  let minDuration = Infinity;
  let minDurationId = '';
  let minDistance = Infinity;
  let minDistanceId = '';
  let minRiskProb = Infinity;
  let minRiskId = '';

  routes.forEach((r) => {
    if (r.duration_minutes < minDuration) {
      minDuration = r.duration_minutes;
      minDurationId = r.id;
    }
    if (r.distance_km < minDistance) {
      minDistance = r.distance_km;
      minDistanceId = r.id;
    }
    const prob = r.risk?.probability ?? 0.5;
    if (prob < minRiskProb) {
      minRiskProb = prob;
      minRiskId = r.id;
    }
  });

  return (
    <div className="sidebar__section animate-fade-in">
      <div className="sidebar__section-title">
        📊 Route Comparison Matrix ({routes.length} Alternatives)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {routes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const risk = route.risk;
          const isFastest = route.id === minDurationId;
          const isShortest = route.id === minDistanceId;
          const isSafest = route.id === minRiskId && (risk?.probability ?? 1) < 0.6;

          // Estimated environmental & fuel metrics
          const fuelLiters = (route.distance_km * 0.28).toFixed(0);
          const co2Kg = (route.distance_km * 0.72).toFixed(0);

          return (
            <div
              key={route.id}
              className={`card card--clickable ${isSelected ? 'card--selected' : ''}`}
              style={{
                borderLeft: `4px solid ${color}`,
                boxShadow: isSelected ? `0 0 16px ${color}33` : undefined,
              }}
              onClick={() => onRouteSelect(route.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onRouteSelect(route.id);
              }}
            >
              {/* Header with badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color }}>
                    Route {idx + 1}
                  </span>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Provider: {route.provider}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
                  {isSafest && (
                    <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      🛡️ Safest
                    </span>
                  )}
                  {isFastest && (
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      ⚡ Fastest
                    </span>
                  )}
                  {isShortest && (
                    <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                      🛣️ Shortest
                    </span>
                  )}
                  {isSelected && (
                    <span className="badge badge--primary">
                      ✓ Active
                    </span>
                  )}
                </div>
              </div>

              {/* Comparative Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px', background: 'var(--color-bg-primary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Distance</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {route.distance_km.toFixed(1)} km
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Duration</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {(route.duration_minutes / 60).toFixed(1)} hrs
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Delay Risk</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: risk ? `var(--color-risk-${risk.risk_band})` : 'inherit' }}>
                    {risk ? `${(risk.probability * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Sustainability & Resource Efficiency */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', padding: '0 4px' }}>
                <span>⛽ Est. Fuel: ~{fuelLiters} L</span>
                <span>🌱 CO₂: ~{co2Kg} kg</span>
                <span style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {isSelected ? 'Currently Loaded 📍' : 'Click to select →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
