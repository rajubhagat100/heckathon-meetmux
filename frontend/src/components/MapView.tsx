import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, RouteCandidate, Coordinates } from '../types';

const ROUTE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4'];

const LOCATION_ICONS: Record<string, string> = {
  supplier: '🏭',
  warehouse: '🏢',
  distribution_center: '📦',
  shop: '🏪',
  port: '⚓',
};

export type TileStyle = 'dark' | 'osm' | 'satellite';

const TILE_PROVIDERS: Record<TileStyle, { url: string; attribution: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
};

interface MapViewProps {
  origin?: Coordinates;
  destination?: Coordinates;
  routes: RouteCandidate[];
  locations: Location[];
  selectedRouteId?: string;
  onRouteSelect?: (routeId: string) => void;
  // Interactive Simulation props
  simulationProgress?: number;
  simulationPlaying?: boolean;
  followVehicle?: boolean;
  // Interactive manual click props
  manualModeActive?: boolean;
  onMapClickSetPoint?: (type: 'origin' | 'destination', coords: Coordinates) => void;
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Interpolate position along polyline coordinates
function getPositionAtProgress(
  coords: [number, number][], // [lon, lat]
  progress: number
): { lat: number; lon: number; bearing: number } | null {
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1 || progress <= 0) {
    return { lat: coords[0][1], lon: coords[0][0], bearing: 0 };
  }
  if (progress >= 1) {
    const last = coords[coords.length - 1];
    const prev = coords[coords.length - 2];
    const bearing = calculateBearing(prev[1], prev[0], last[1], last[0]);
    return { lat: last[1], lon: last[0], bearing };
  }

  // Calculate cumulative segment distances
  const dists: number[] = [0];
  let totalDist = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const d = Math.hypot(lat2 - lat1, lon2 - lon1);
    totalDist += d;
    dists.push(totalDist);
  }

  const targetDist = progress * totalDist;

  // Find segment
  for (let i = 0; i < dists.length - 1; i++) {
    if (targetDist >= dists[i] && targetDist <= dists[i + 1]) {
      const segDist = dists[i + 1] - dists[i];
      const t = segDist === 0 ? 0 : (targetDist - dists[i]) / segDist;
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const lat = lat1 + (lat2 - lat1) * t;
      const lon = lon1 + (lon2 - lon1) * t;
      const bearing = calculateBearing(lat1, lon1, lat2, lon2);
      return { lat, lon, bearing };
    }
  }

  const last = coords[coords.length - 1];
  return { lat: last[1], lon: last[0], bearing: 0 };
}

export default function MapView({
  origin,
  destination,
  routes,
  locations,
  selectedRouteId,
  onRouteSelect,
  simulationProgress = 0,
  followVehicle = false,
  manualModeActive = false,
  onMapClickSetPoint,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<L.LayerGroup>(L.layerGroup());
  const vehicleMarkerRef = useRef<L.Marker | null>(null);

  const [tileStyle, setTileStyle] = useState<TileStyle>('dark');
  const [showNetworkNodes, setShowNetworkNodes] = useState(true);
  const [nextManualClick, setNextManualClick] = useState<'origin' | 'destination'>('origin');

  // Change base tile layer
  const updateTileLayer = useCallback((style: TileStyle) => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const provider = TILE_PROVIDERS[style];
    const newLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = newLayer;
    setTileStyle(style);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: false, // Custom position
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const provider = TILE_PROVIDERS.dark;
    const initialTile = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    tileLayerRef.current = initialTile;

    layersRef.current.addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle map click in manual mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function handleMapClick(e: L.LeafletMouseEvent) {
      if (!manualModeActive || !onMapClickSetPoint) return;
      const coords = { lat: Number(e.latlng.lat.toFixed(5)), lon: Number(e.latlng.lng.toFixed(5)) };
      onMapClickSetPoint(nextManualClick, coords);
      setNextManualClick((prev) => (prev === 'origin' ? 'destination' : 'origin'));
    }

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [manualModeActive, nextManualClick, onMapClickSetPoint]);

  // Update map contents: routes, markers, locations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layers = layersRef.current;
    layers.clearLayers();
    vehicleMarkerRef.current = null;

    const bounds: L.LatLngExpression[] = [];

    // Draw Route Candidates
    routes.forEach((route, idx) => {
      if (!route.geometry?.coordinates?.length) return;

      const latlngs: L.LatLngExpression[] = route.geometry.coordinates.map(
        (coord) => [coord[1], coord[0]] as L.LatLngExpression
      );

      const isSelected = route.id === selectedRouteId;
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

      // Outer glow for selected route
      if (isSelected) {
        const glowPolyline = L.polyline(latlngs, {
          color,
          weight: 10,
          opacity: 0.25,
          lineCap: 'round',
        });
        glowPolyline.addTo(layers);
      }

      const polyline = L.polyline(latlngs, {
        color,
        weight: isSelected ? 5 : 3,
        opacity: isSelected ? 0.95 : 0.45,
        dashArray: isSelected ? undefined : '6 6',
      });

      polyline.on('click', () => onRouteSelect?.(route.id));

      const riskLabel = route.risk
        ? `${route.risk.risk_band.toUpperCase()} Risk (${(route.risk.probability * 100).toFixed(0)}%)`
        : '';

      polyline.bindPopup(
        `<div class="map-popup__title" style="color: ${color};">Route ${idx + 1}</div>
         <div class="map-popup__detail">📏 ${route.distance_km.toFixed(1)} km · ⏱️ ${(route.duration_minutes / 60).toFixed(1)} hrs</div>
         ${riskLabel ? `<div class="map-popup__detail">⚠️ ${riskLabel}</div>` : ''}
         <div style="margin-top:6px;"><span class="badge badge--primary" style="cursor:pointer;">Select Route</span></div>`
      );

      polyline.addTo(layers);
      bounds.push(...latlngs);
    });

    // Origin Marker (Pulsing Green Pin)
    if (origin) {
      const originIcon = L.divIcon({
        html: `<div class="pin-marker pin-marker--origin">
                 <div class="pin-marker__ring"></div>
                 <div class="pin-marker__core">📍</div>
               </div>`,
        className: 'custom-pin-container',
        iconSize: [32, 32],
        iconAnchor: [16, 30],
      });
      const marker = L.marker([origin.lat, origin.lon], { icon: originIcon });
      marker.bindPopup('<div class="map-popup__title">🟢 Origin Departure Point</div>');
      marker.addTo(layers);
      bounds.push([origin.lat, origin.lon]);
    }

    // Destination Marker (Pulsing Red Pin)
    if (destination) {
      const destIcon = L.divIcon({
        html: `<div class="pin-marker pin-marker--dest">
                 <div class="pin-marker__ring"></div>
                 <div class="pin-marker__core">🏁</div>
               </div>`,
        className: 'custom-pin-container',
        iconSize: [32, 32],
        iconAnchor: [16, 30],
      });
      const marker = L.marker([destination.lat, destination.lon], { icon: destIcon });
      marker.bindPopup('<div class="map-popup__title">🔴 Destination Arrival Point</div>');
      marker.addTo(layers);
      bounds.push([destination.lat, destination.lon]);
    }

    // Supply-chain Location Markers
    if (showNetworkNodes) {
      locations.forEach((loc) => {
        if (
          origin &&
          Math.abs(loc.coordinates.lat - origin.lat) < 0.001 &&
          Math.abs(loc.coordinates.lon - origin.lon) < 0.001
        ) return;
        if (
          destination &&
          Math.abs(loc.coordinates.lat - destination.lat) < 0.001 &&
          Math.abs(loc.coordinates.lon - destination.lon) < 0.001
        ) return;

        const icon = LOCATION_ICONS[loc.type] || '📍';

        const customIcon = L.divIcon({
          html: `<div class="network-node-marker">
                   <span>${icon}</span>
                   <span class="network-node-marker__label">${loc.name.split(' ').slice(0, 2).join(' ')}</span>
                 </div>`,
          className: 'network-node-wrapper',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([loc.coordinates.lat, loc.coordinates.lon], { icon: customIcon });
        marker.bindPopup(
          `<div class="map-popup__title">${icon} ${loc.name}</div>
           <div class="map-popup__detail">${loc.type.replace('_', ' ').toUpperCase()}</div>
           ${loc.address ? `<div class="map-popup__detail">${loc.address}</div>` : ''}`
        );
        marker.addTo(layers);
        bounds.push([loc.coordinates.lat, loc.coordinates.lon]);
      });
    }

    // Fit map bounds smoothly
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 13 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0] as L.LatLngExpression, 10);
    }
  }, [origin, destination, routes, locations, selectedRouteId, onRouteSelect, showNetworkNodes]);

  // Update animated vehicle marker position during simulation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
    if (!activeRoute?.geometry?.coordinates?.length) {
      if (vehicleMarkerRef.current) {
        layersRef.current.removeLayer(vehicleMarkerRef.current);
        vehicleMarkerRef.current = null;
      }
      return;
    }

    const pos = getPositionAtProgress(
      activeRoute.geometry.coordinates as [number, number][],
      simulationProgress
    );

    if (!pos) return;

    if (!vehicleMarkerRef.current) {
      const vehicleIcon = L.divIcon({
        html: `<div class="sim-truck-marker">
                 <div class="sim-truck-marker__pulse"></div>
                 <div class="sim-truck-marker__icon">🚚</div>
               </div>`,
        className: 'sim-truck-wrapper',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([pos.lat, pos.lon], { icon: vehicleIcon, zIndexOffset: 2000 });
      marker.addTo(layersRef.current);
      vehicleMarkerRef.current = marker;
    } else {
      vehicleMarkerRef.current.setLatLng([pos.lat, pos.lon]);
    }

    if (followVehicle) {
      map.panTo([pos.lat, pos.lon], { animate: true, duration: 0.3 });
    }
  }, [simulationProgress, routes, selectedRouteId, followVehicle]);

  // Reset view to bounds
  function handleFitAll() {
    const map = mapRef.current;
    if (!map) return;
    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
    if (activeRoute?.geometry?.coordinates?.length) {
      const latlngs = activeRoute.geometry.coordinates.map((c) => [c[1], c[0]] as [number, number]);
      map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map Interactive HUD Toolbar */}
      <div className="map-hud-toolbar">
        {/* Tile Provider Switcher */}
        <div className="map-hud-btn-group">
          {(['dark', 'osm', 'satellite'] as TileStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              className={`map-hud-btn ${tileStyle === style ? 'map-hud-btn--active' : ''}`}
              onClick={() => updateTileLayer(style)}
              title={`Switch to ${style} map style`}
            >
              {style === 'dark' ? '🌙 Dark' : style === 'osm' ? '🗺️ Street' : '🛰️ Satellite'}
            </button>
          ))}
        </div>

        {/* Toggle Network Nodes */}
        <button
          type="button"
          className={`map-hud-btn ${showNetworkNodes ? 'map-hud-btn--active' : ''}`}
          onClick={() => setShowNetworkNodes((v) => !v)}
          title="Toggle supply chain node markers"
        >
          {showNetworkNodes ? '🏢 Nodes: On' : '🏢 Nodes: Off'}
        </button>

        {/* Fit Bounds Button */}
        <button
          type="button"
          className="map-hud-btn"
          onClick={handleFitAll}
          title="Zoom to fit active route"
        >
          🔍 Fit Route
        </button>
      </div>

      {/* Manual Pin Click Instructions Banner */}
      {manualModeActive && (
        <div className="map-click-helper animate-fade-in">
          <span>
            👉 <strong>Click anywhere on map</strong> to place{' '}
            <span style={{ color: nextManualClick === 'origin' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
              {nextManualClick.toUpperCase()} ({nextManualClick === 'origin' ? 'Origin 🟢' : 'Destination 🔴'})
            </span>
          </span>
        </div>
      )}

      {/* Leaflet container */}
      <div ref={containerRef} className="map-container" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
