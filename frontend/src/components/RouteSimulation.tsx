import type { RouteCandidate } from '../types';

interface RouteSimulationProps {
  route: RouteCandidate;
  originName?: string;
  destinationName?: string;
  progress: number; // 0 to 1
  isPlaying: boolean;
  speed: number;
  followVehicle: boolean;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onProgressChange: (progress: number) => void;
  onReset: () => void;
  onToggleFollow: () => void;
}

export default function RouteSimulation({
  route,
  originName = 'Origin',
  destinationName = 'Destination',
  progress,
  isPlaying,
  speed,
  followVehicle,
  onPlayPause,
  onSpeedChange,
  onProgressChange,
  onReset,
  onToggleFollow,
}: RouteSimulationProps) {
  const distanceCovered = (route.distance_km * progress).toFixed(1);
  const distanceRemaining = (route.distance_km * (1 - progress)).toFixed(1);
  const durationRemainingMinutes = Math.round(route.duration_minutes * (1 - progress));
  const hoursRemaining = Math.floor(durationRemainingMinutes / 60);
  const minsRemaining = durationRemainingMinutes % 60;

  // Realistic dynamic speed calculation
  const currentSpeed = progress === 0 || progress === 1 ? 0 : Math.round(55 + Math.sin(progress * 12) * 18);

  // Dynamic waypoint milestone
  let phaseName = 'Departing Origin Terminal';
  let phaseIcon = '🛫';
  let phaseStatus = 'Clear Road';

  if (progress >= 1) {
    phaseName = 'Delivered at Destination';
    phaseIcon = '🏁';
    phaseStatus = 'Completed';
  } else if (progress > 0.8) {
    phaseName = `Final Mile Approach: ${destinationName}`;
    phaseIcon = '📦';
    phaseStatus = 'Moderate Traffic';
  } else if (progress > 0.5) {
    phaseName = 'Interstate Highway Corridor';
    phaseIcon = '🚛';
    phaseStatus = route.risk?.risk_band === 'high' ? 'Congestion Warning' : 'Fluid Flow';
  } else if (progress > 0.2) {
    phaseName = 'Regional Transit & Toll Plaza';
    phaseIcon = '🛣️';
    phaseStatus = 'Nominal Conditions';
  }

  const speedOptions = [1, 2, 5, 10];

  return (
    <div className="simulation-panel animate-fade-in">
      {/* Simulation Header */}
      <div className="simulation-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="live-pulse-dot" />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            Live Transit Simulation
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn--sm ${followVehicle ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '11px', padding: '2px 8px' }}
            onClick={onToggleFollow}
            title="Auto-center camera on vehicle position"
          >
            {followVehicle ? '📍 Following' : '📍 Free Cam'}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            style={{ fontSize: '11px', padding: '2px 8px' }}
            onClick={onReset}
            title="Reset simulation to beginning"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Vehicle Telemetry HUD */}
      <div className="telemetry-grid">
        <div className="telemetry-card">
          <div className="telemetry-card__label">Simulated Speed</div>
          <div className="telemetry-card__value">
            {currentSpeed} <span className="telemetry-card__unit">km/h</span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-card__label">Distance Done</div>
          <div className="telemetry-card__value">
            {distanceCovered} <span className="telemetry-card__unit">/ {route.distance_km.toFixed(0)} km</span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-card__label">Est. Remaining</div>
          <div className="telemetry-card__value">
            {hoursRemaining > 0 ? `${hoursRemaining}h ` : ''}{minsRemaining}m
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-card__label">Remaining Dist</div>
          <div className="telemetry-card__value">
            {distanceRemaining} <span className="telemetry-card__unit">km</span>
          </div>
        </div>
      </div>

      {/* Current Waypoint Status */}
      <div className="waypoint-status">
        <div style={{ fontSize: '18px' }}>{phaseIcon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {phaseName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Status: <span style={{ color: phaseStatus.includes('Warning') ? 'var(--color-risk-high)' : 'var(--color-risk-low)' }}>{phaseStatus}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-accent)' }}>
            {Math.round(progress * 100)}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>completed</div>
        </div>
      </div>

      {/* Progress Timeline Scrubber */}
      <div style={{ margin: 'var(--space-md) 0 var(--space-xs)' }}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(e) => onProgressChange(parseFloat(e.target.value))}
          className="simulation-slider"
          aria-label="Simulation progress scrubber"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          <span>📍 {originName.split(' ')[0]}</span>
          <span>🛣️ Active Transit</span>
          <span>🏁 {destinationName.split(' ')[0]}</span>
        </div>
      </div>

      {/* Controls Bar: Play/Pause, Step, Speed */}
      <div className="simulation-controls">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onProgressChange(Math.max(0, progress - 0.05))}
          title="Step back 5%"
        >
          ⏪ -5%
        </button>

        <button
          type="button"
          className={`btn ${isPlaying ? 'btn--accent' : 'btn--primary'} btn--sm`}
          style={{ minWidth: '100px', fontWeight: 600 }}
          onClick={onPlayPause}
        >
          {isPlaying ? '⏸️ Pause' : progress >= 1 ? '↺ Replay' : '▶️ Play'}
        </button>

        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onProgressChange(Math.min(1, progress + 0.05))}
          title="Step forward 5%"
        >
          ⏩ +5%
        </button>

        <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginRight: '2px' }}>Speed:</span>
          {speedOptions.map((s) => (
            <button
              key={s}
              type="button"
              className={`speed-pill ${speed === s ? 'speed-pill--active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* High Risk Alert Banner during simulation */}
      {route.risk && route.risk.risk_band === 'high' && progress > 0.35 && progress < 0.75 && (
        <div className="simulation-alert animate-fade-in">
          <span>⚠️ <strong>High Risk Zone Detected:</strong> Driver encountering weather/traffic bottleneck. ETA extended by ~25 mins.</span>
        </div>
      )}
    </div>
  );
}
