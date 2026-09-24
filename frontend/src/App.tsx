import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type {
  Coordinates,
  HealthResponse,
  Location,
  RouteCandidate,
  ShipmentDetail,
  ShipmentNetworkResponse,
} from './types';
import { getHealth, getShipmentNetwork, planRoutes } from './services/api';
import ShipmentSelector from './components/ShipmentSelector';
import ShipmentInfo from './components/ShipmentInfo';
import RouteList from './components/RouteList';
import RiskDetails from './components/RiskDetails';
import MapView from './components/MapView';
import NetworkLocations from './components/NetworkLocations';
import RouteSimulation from './components/RouteSimulation';
import RiskSimulator from './components/RiskSimulator';
import RouteComparison from './components/RouteComparison';

type ActiveTab = 'overview' | 'simulation' | 'risk_lab' | 'compare' | 'network';

interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentDetail | null>(null);
  const [network, setNetwork] = useState<ShipmentNetworkResponse | null>(null);
  const [manualOrigin, setManualOrigin] = useState<Coordinates | null>(null);
  const [manualDest, setManualDest] = useState<Coordinates | null>(null);
  const [selectorMode, setSelectorMode] = useState<'shipment' | 'manual'>('shipment');

  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(undefined);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Sidebar Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Interactive Simulation State
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationPlaying, setSimulationPlaying] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [followVehicle, setFollowVehicle] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const fetchHealth = async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  };

  // Load health check on mount
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Simulation Animation Loop
  useEffect(() => {
    if (!simulationPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastTimeRef.current != null) {
        const deltaSec = (timestamp - lastTimeRef.current) / 1000;
        // Total route animation duration roughly 25 seconds at 1x speed
        const progressIncrement = (deltaSec / 25) * simulationSpeed;

        setSimulationProgress((prev) => {
          const next = prev + progressIncrement;
          if (next >= 1) {
            setSimulationPlaying(false);
            addToast('🏁 Simulation completed: Arrived at destination!', 'success');
            return 1;
          }
          return next;
        });
      }
      lastTimeRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simulationPlaying, simulationSpeed, addToast]);

  // Handle shipment selection
  async function handleShipmentSelect(shipment: ShipmentDetail) {
    setSelectedShipment(shipment);
    setManualOrigin(null);
    setManualDest(null);
    setError(null);
    setRoutes([]);
    setSelectedRouteId(undefined);
    setSimulationProgress(0);
    setSimulationPlaying(false);
    setActiveTab('overview');

    addToast(`Selected ${shipment.id}: ${shipment.origin.name} ➔ ${shipment.destination.name}`, 'info');

    // Fetch network context in parallel
    getShipmentNetwork(shipment.id)
      .then((net) => setNetwork(net))
      .catch((err) => {
        console.warn('Network context unavailable:', err);
        setNetwork(null);
      });

    // Plan candidate routes
    setLoadingRoutes(true);
    try {
      const plan = await planRoutes({
        origin: shipment.origin.coordinates,
        destination: shipment.destination.coordinates,
        shipment_id: shipment.id,
      });
      setRoutes(plan.routes);
      if (plan.routes.length > 0) {
        setSelectedRouteId(plan.routes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve route options');
    } finally {
      setLoadingRoutes(false);
    }
  }

  // Handle manual origin/destination route planning
  async function handleManualRoute(origin: Coordinates, destination: Coordinates) {
    setSelectedShipment(null);
    setNetwork(null);
    setManualOrigin(origin);
    setManualDest(destination);
    setError(null);
    setRoutes([]);
    setSelectedRouteId(undefined);
    setSimulationProgress(0);
    setSimulationPlaying(false);
    setActiveTab('overview');

    addToast(`Routing from [${origin.lat}, ${origin.lon}] to [${destination.lat}, ${destination.lon}]`, 'info');

    setLoadingRoutes(true);
    try {
      const plan = await planRoutes({
        origin,
        destination,
      });
      setRoutes(plan.routes);
      if (plan.routes.length > 0) {
        setSelectedRouteId(plan.routes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to plan route for custom coordinates');
    } finally {
      setLoadingRoutes(false);
    }
  }

  // Handle click on map to set points
  function handleMapClickSetPoint(type: 'origin' | 'destination', coords: Coordinates) {
    if (type === 'origin') {
      setManualOrigin(coords);
      addToast(`Set Origin to [${coords.lat}, ${coords.lon}] 🟢`, 'info');
      if (manualDest) {
        handleManualRoute(coords, manualDest);
      }
    } else {
      setManualDest(coords);
      addToast(`Set Destination to [${coords.lat}, ${coords.lon}] 🔴`, 'info');
      if (manualOrigin) {
        handleManualRoute(manualOrigin, coords);
      }
    }
  }

  // Current active route and risk
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) || routes[0],
    [routes, selectedRouteId]
  );

  const activeOrigin = selectedShipment ? selectedShipment.origin.coordinates : manualOrigin || undefined;
  const activeDest = selectedShipment ? selectedShipment.destination.coordinates : manualDest || undefined;

  // Map locations list
  const mapLocations: Location[] = useMemo(() => {
    const locs: Location[] = [];
    if (selectedShipment) {
      locs.push(selectedShipment.origin, selectedShipment.destination);
    }
    if (network?.locations) {
      for (const loc of network.locations) {
        if (!locs.some((l) => l.id === loc.id)) {
          locs.push(loc);
        }
      }
    }
    return locs;
  }, [selectedShipment, network]);

  const isDemoData = Boolean(
    selectedShipment?.is_demo_data || routes.some((r) => r.provider === 'mock')
  );

  const originName = selectedShipment ? selectedShipment.origin.name : 'Custom Origin';
  const destName = selectedShipment ? selectedShipment.destination.name : 'Custom Destination';

  return (
    <div className="app-layout">
      {/* ── App Header ── */}
      <header className="app-header">
        <div className="app-header__logo">
          <div className="app-header__logo-icon">⚡</div>
          <div>
            <div className="app-header__title">MeetMux Logistics</div>
            <div className="app-header__subtitle">Supply Chain Delay Risk Intelligence & Route Planning</div>
          </div>
        </div>

        {/* Live Operations Stats Ticker */}
        <div className="header-ticker">
          <div className="ticker-item">
            <span className="ticker-item__label">Fleet Reliability</span>
            <span className="ticker-item__val ticker-item__val--good">94.8%</span>
          </div>
          <div className="ticker-item">
            <span className="ticker-item__label">Monitored Routes</span>
            <span className="ticker-item__val">{routes.length > 0 ? routes.length : '—'}</span>
          </div>
          <div className="ticker-item">
            <span className="ticker-item__label">Network Nodes</span>
            <span className="ticker-item__val">{mapLocations.length > 0 ? mapLocations.length : '12'}</span>
          </div>
        </div>

        <div className="app-header__spacer" />

        {/* System Health Indicators */}
        <div className="app-header__status">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: health?.status === 'healthy' ? '#22c55e' : health ? '#f59e0b' : '#ef4444',
                boxShadow: `0 0 6px ${health?.status === 'healthy' ? '#22c55e' : '#ef4444'}`,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-primary)' }}>
              {health ? health.status.toUpperCase() : 'OFFLINE'}
            </span>
          </div>

          {health && health.dependencies && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {health.dependencies.map((dep) => (
                <span key={dep.name}>
                  {dep.name.replace('_', ' ')}:{' '}
                  <strong
                    style={{
                      color:
                        dep.status === 'healthy'
                          ? 'var(--color-risk-low)'
                          : dep.status === 'degraded'
                          ? 'var(--color-risk-medium)'
                          : 'var(--color-risk-high)',
                    }}
                  >
                    {dep.status}
                  </strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="app-main">
        {/* Left Sidebar: Controls & Details */}
        <aside className="sidebar">
          <div className="sidebar__scroll">
            {/* Shipment Selection & Filter */}
            <ShipmentSelector
              onShipmentSelect={handleShipmentSelect}
              onManualRoute={handleManualRoute}
              selectedShipmentId={selectedShipment?.id}
              onModeChange={setSelectorMode}
              manualOriginCoords={manualOrigin}
              manualDestCoords={manualDest}
            />

            {/* Error Message */}
            {error && (
              <div
                style={{
                  margin: 'var(--space-sm) var(--space-md)',
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-risk-high)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>⚠️ {error}</span>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ padding: '2px 6px', fontSize: '10px' }}
                  onClick={() => setError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Interactive Feature Tabs */}
            {(selectedShipment || routes.length > 0) && (
              <div className="sidebar__section" style={{ paddingBottom: 0 }}>
                <div className="tab-bar">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'overview' ? 'tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                  >
                    🗺️ Routes
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'simulation' ? 'tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('simulation')}
                  >
                    ⚡ Simulate
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'risk_lab' ? 'tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('risk_lab')}
                  >
                    🧪 What-If
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'compare' ? 'tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('compare')}
                  >
                    📊 Matrix
                  </button>
                  {network && network.locations.length > 0 && (
                    <button
                      type="button"
                      className={`tab-btn ${activeTab === 'network' ? 'tab-btn--active' : ''}`}
                      onClick={() => setActiveTab('network')}
                    >
                      🕸️ Nodes
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 1: Overview & Routes */}
            {activeTab === 'overview' && (
              <>
                {/* Selected Shipment Details */}
                {selectedShipment && (
                  <ShipmentInfo
                    shipment={selectedShipment}
                    onCopyNotice={(msg) => addToast(msg, 'success')}
                  />
                )}

                {/* Candidate Route Comparison */}
                <RouteList
                  routes={routes}
                  selectedRouteId={selectedRouteId}
                  onRouteSelect={(id) => {
                    setSelectedRouteId(id);
                    addToast(`Switched to Route ${routes.findIndex((r) => r.id === id) + 1}`, 'info');
                  }}
                  isLoading={loadingRoutes}
                  isDemoData={isDemoData}
                />

                {/* Risk Factor Breakdown for Selected Route */}
                {selectedRoute?.risk && (
                  <RiskDetails
                    risk={selectedRoute.risk}
                    routeLabel={`Route ${routes.findIndex((r) => r.id === selectedRoute.id) + 1}`}
                  />
                )}
              </>
            )}

            {/* TAB CONTENT 2: Transit Simulation */}
            {activeTab === 'simulation' && selectedRoute && (
              <RouteSimulation
                route={selectedRoute}
                originName={originName}
                destinationName={destName}
                progress={simulationProgress}
                isPlaying={simulationPlaying}
                speed={simulationSpeed}
                followVehicle={followVehicle}
                onPlayPause={() => {
                  if (simulationProgress >= 1) setSimulationProgress(0);
                  setSimulationPlaying(!simulationPlaying);
                }}
                onSpeedChange={(s) => {
                  setSimulationSpeed(s);
                  addToast(`Simulation speed set to ${s}x`, 'info');
                }}
                onProgressChange={(p) => setSimulationProgress(p)}
                onReset={() => {
                  setSimulationProgress(0);
                  setSimulationPlaying(false);
                }}
                onToggleFollow={() => setFollowVehicle(!followVehicle)}
              />
            )}

            {/* TAB CONTENT 3: What-If Risk Lab */}
            {activeTab === 'risk_lab' && selectedRoute && (
              <RiskSimulator
                baseRisk={selectedRoute.risk}
                route={selectedRoute}
              />
            )}

            {/* TAB CONTENT 4: Side-by-Side Comparison */}
            {activeTab === 'compare' && (
              <RouteComparison
                routes={routes}
                selectedRouteId={selectedRouteId}
                onRouteSelect={(id) => {
                  setSelectedRouteId(id);
                  addToast(`Selected Route ${routes.findIndex((r) => r.id === id) + 1}`, 'info');
                }}
              />
            )}

            {/* TAB CONTENT 5: Connected Supply Chain Network */}
            {activeTab === 'network' && network && (
              <NetworkLocations
                locations={network.locations}
                links={network.links}
                isDemoData={network.is_demo_data}
                onLocationClick={(loc) => {
                  addToast(`Focused on ${loc.name} (${loc.type})`, 'info');
                }}
              />
            )}
          </div>
        </aside>

        {/* Right Area: Interactive Map & Live HUD */}
        <main className="map-container">
          {/* Quick HUD overlay over the map */}
          {selectedRoute && (
            <div className="map-top-hud animate-fade-in">
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Active Route
                </div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Route {routes.findIndex((r) => r.id === selectedRoute.id) + 1} of {routes.length}
                </div>
              </div>

              <div style={{ height: 28, width: 1, background: 'var(--color-border)' }} />

              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Distance
                </div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {selectedRoute.distance_km.toFixed(1)} km
                </div>
              </div>

              <div style={{ height: 28, width: 1, background: 'var(--color-border)' }} />

              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Est. Travel Time
                </div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {(selectedRoute.duration_minutes / 60).toFixed(1)} hrs
                </div>
              </div>

              {selectedRoute.risk && (
                <>
                  <div style={{ height: 28, width: 1, background: 'var(--color-border)' }} />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Delay Risk
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge badge--risk-${selectedRoute.risk.risk_band}`}>
                        {selectedRoute.risk.risk_band}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        ({(selectedRoute.risk.probability * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Quick Play/Pause Simulator Shortcut on Map */}
              <div style={{ height: 28, width: 1, background: 'var(--color-border)' }} />
              <div>
                <button
                  type="button"
                  className={`btn btn--sm ${simulationPlaying ? 'btn--accent' : 'btn--primary'}`}
                  style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 600 }}
                  onClick={() => {
                    setActiveTab('simulation');
                    setSimulationPlaying(!simulationPlaying);
                  }}
                >
                  {simulationPlaying ? '⏸️ Pause Sim' : '▶️ Play Sim'}
                </button>
              </div>
            </div>
          )}

          {/* Interactive Map View */}
          <MapView
            origin={activeOrigin}
            destination={activeDest}
            routes={routes}
            locations={mapLocations}
            selectedRouteId={selectedRouteId}
            onRouteSelect={(id) => {
              setSelectedRouteId(id);
              addToast(`Selected Route ${routes.findIndex((r) => r.id === id) + 1}`, 'info');
            }}
            simulationProgress={simulationProgress}
            simulationPlaying={simulationPlaying}
            followVehicle={followVehicle}
            manualModeActive={selectorMode === 'manual'}
            onMapClickSetPoint={handleMapClickSetPoint}
          />

          {/* Interactive Floating Toasts */}
          <div className="toast-container">
            {toasts.map((t) => (
              <div key={t.id} className={`toast toast--${t.type || 'info'} animate-slide-in`}>
                <span>{t.message}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
