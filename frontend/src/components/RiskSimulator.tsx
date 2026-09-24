import { useState, useMemo } from 'react';
import type { DelayRisk, RiskBand, RouteCandidate } from '../types';

interface RiskSimulatorProps {
  baseRisk?: DelayRisk;
  route: RouteCandidate;
}

export default function RiskSimulator({ baseRisk, route }: RiskSimulatorProps) {
  const [weather, setWeather] = useState<'clear' | 'rain' | 'storm' | 'fog'>('clear');
  const [traffic, setTraffic] = useState<'low' | 'moderate' | 'heavy' | 'gridlock'>('moderate');
  const [driverHours, setDriverHours] = useState<number>(4);
  const [roadWork, setRoadWork] = useState<boolean>(false);
  const [coldChain, setColdChain] = useState<boolean>(false);
  const [vehicleStatus, setVehicleStatus] = useState<'optimal' | 'warning'>('optimal');

  const baseProb = baseRisk?.probability ?? 0.35;

  // Calculate simulated risk dynamically
  const simulation = useMemo(() => {
    let prob = baseProb;

    // Weather impact
    if (weather === 'rain') prob += 0.12;
    if (weather === 'storm') prob += 0.28;
    if (weather === 'fog') prob += 0.18;

    // Traffic impact
    if (traffic === 'moderate') prob += 0.06;
    if (traffic === 'heavy') prob += 0.16;
    if (traffic === 'gridlock') prob += 0.26;

    // Driver fatigue
    if (driverHours > 8) {
      prob += (driverHours - 8) * 0.045;
    }

    // Road construction
    if (roadWork) prob += 0.11;

    // Vehicle status
    if (vehicleStatus === 'warning') prob += 0.14;

    // Bound probability
    const clampedProb = Math.min(0.98, Math.max(0.04, prob));

    let band: RiskBand = 'low';
    if (clampedProb > 0.8) band = 'critical';
    else if (clampedProb > 0.6) band = 'high';
    else if (clampedProb > 0.3) band = 'medium';

    const deltaPercent = Math.round((clampedProb - baseProb) * 100);
    const estDelayMinutes = Math.round(clampedProb * (route.duration_minutes * 0.45));
    const estimatedPenalty = Math.round(estDelayMinutes * 6.2 + (coldChain && clampedProb > 0.5 ? 420 : 0));

    // Dynamic AI Recommendations
    const recommendations: string[] = [];
    if (weather === 'storm' || weather === 'fog') {
      recommendations.push('Delay departure by 90 minutes or divert to southern expressway.');
    }
    if (traffic === 'gridlock' || traffic === 'heavy') {
      recommendations.push('Utilize toll-bypass corridors to circumvent urban pinch point.');
    }
    if (driverHours > 8) {
      recommendations.push('Mandatory 45-min rest stop required at next logistics hub.');
    }
    if (roadWork) {
      recommendations.push('Active work zone: speed restricted to 40 km/h for 18 km.');
    }
    if (coldChain && clampedProb > 0.5) {
      recommendations.push('🚨 Cold-chain risk: Active reefer battery backup required.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Operating conditions are optimal. Proceed on scheduled route.');
    }

    return {
      probability: clampedProb,
      band,
      deltaPercent,
      estDelayMinutes,
      estimatedPenalty,
      recommendations,
    };
  }, [baseProb, weather, traffic, driverHours, roadWork, coldChain, vehicleStatus, route.duration_minutes]);

  function handleReset() {
    setWeather('clear');
    setTraffic('moderate');
    setDriverHours(4);
    setRoadWork(false);
    setColdChain(false);
    setVehicleStatus('optimal');
  }

  return (
    <div className="sidebar__section animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div>
          <div className="sidebar__section-title" style={{ margin: 0 }}>
            🧪 "What-If" Delay Risk Lab
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Simulate operational variables in real-time
          </div>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

      {/* Dynamic Results Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          borderColor: `var(--color-risk-${simulation.band})`,
          boxShadow: `0 0 16px rgba(0, 0, 0, 0.4), inset 0 0 12px var(--color-accent-glow)`,
          marginBottom: 'var(--space-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Simulated Delay Risk
          </span>
          <span className={`badge badge--risk-${simulation.band}`}>
            {simulation.band.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: `var(--color-risk-${simulation.band})` }}>
            {(simulation.probability * 100).toFixed(0)}%
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: simulation.deltaPercent > 0 ? 'var(--color-risk-high)' : simulation.deltaPercent < 0 ? 'var(--color-risk-low)' : 'var(--color-text-muted)',
            }}
          >
            {simulation.deltaPercent > 0 ? `▲ +${simulation.deltaPercent}% from base` : simulation.deltaPercent < 0 ? `▼ ${simulation.deltaPercent}% from base` : 'Equal to base'}
          </span>
        </div>

        {/* Meter */}
        <div className="risk-meter" style={{ height: '8px', marginBottom: '12px' }}>
          <div
            className={`risk-meter__fill risk-meter__fill--${simulation.band}`}
            style={{ width: `${Math.max(simulation.probability * 100, 6)}%` }}
          />
        </div>

        {/* Projected Impact Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Projected Delay</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              +{simulation.estDelayMinutes} mins
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Estimated Cost Penalty</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: simulation.estimatedPenalty > 200 ? 'var(--color-risk-high)' : 'var(--color-text-primary)' }}>
              ${simulation.estimatedPenalty}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="simulator-controls" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {/* Weather Selector */}
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
            🌦️ Weather Conditions
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {[
              { id: 'clear', label: '☀️ Clear' },
              { id: 'rain', label: '🌧️ Rain' },
              { id: 'fog', label: '🌫️ Fog' },
              { id: 'storm', label: '⛈️ Storm' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn btn--sm ${weather === item.id ? 'btn--primary' : 'btn--secondary'}`}
                style={{ fontSize: '11px', padding: '6px 2px', textAlign: 'center' }}
                onClick={() => setWeather(item.id as any)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Traffic Density */}
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
            🚦 Traffic Density
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {[
              { id: 'low', label: '🟢 Low' },
              { id: 'moderate', label: '🟡 Med' },
              { id: 'heavy', label: '🟠 Heavy' },
              { id: 'gridlock', label: '🔴 Jam' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn btn--sm ${traffic === item.id ? 'btn--primary' : 'btn--secondary'}`}
                style={{ fontSize: '11px', padding: '6px 2px', textAlign: 'center' }}
                onClick={() => setTraffic(item.id as any)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Driver Hours Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>
              ⏱️ Driver Continuous Hours
            </span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: driverHours > 8 ? 'var(--color-risk-high)' : 'var(--color-text-primary)' }}>
              {driverHours} hrs {driverHours > 8 ? '(Fatigue Risk)' : ''}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="14"
            step="1"
            value={driverHours}
            onChange={(e) => setDriverHours(parseInt(e.target.value))}
            className="simulation-slider"
            aria-label="Driver continuous hours slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            <span>1 hr</span>
            <span style={{ color: 'var(--color-risk-medium)' }}>8 hr limit</span>
            <span>14 hrs</span>
          </div>
        </div>

        {/* Operational Toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <label
            className="toggle-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: roadWork ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-bg-elevated)',
              border: `1px solid ${roadWork ? 'var(--color-risk-medium)' : 'var(--color-border)'}`,
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <input
              type="checkbox"
              checked={roadWork}
              onChange={(e) => setRoadWork(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span>🚧 Road Work Zone</span>
          </label>

          <label
            className="toggle-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: coldChain ? 'rgba(59, 130, 246, 0.12)' : 'var(--color-bg-elevated)',
              border: `1px solid ${coldChain ? 'var(--color-accent)' : 'var(--color-border)'}`,
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <input
              type="checkbox"
              checked={coldChain}
              onChange={(e) => setColdChain(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span>❄️ Cold Chain Cargo</span>
          </label>
        </div>

        {/* Vehicle Maintenance Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '11px' }}>🔧 Fleet Maintenance Status:</span>
          <button
            type="button"
            className={`btn btn--sm ${vehicleStatus === 'optimal' ? 'btn--secondary' : 'btn--accent'}`}
            style={{ fontSize: '10px', padding: '2px 8px' }}
            onClick={() => setVehicleStatus(vehicleStatus === 'optimal' ? 'warning' : 'optimal')}
          >
            {vehicleStatus === 'optimal' ? '🟢 Checked & Nominal' : '⚠️ Minor Diagnostic Alert'}
          </button>
        </div>

        {/* AI Recommendations */}
        <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '4px' }}>
            💡 AI Dispatch Recommendations
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {simulation.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
