import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface Hotspot {
  name: string;
  location: string;
  coordinates: string;
  intensity: 'Critical' | 'High' | 'Moderate' | 'Low';
  plasticDensity: string;
  color: string;
  lat: number;
  lng: number;
  detectionCount?: number;
  pollutionScore?: number;
  avgPollutionLevel?: number;
  maxPollutionLevel?: number;
  minPollutionLevel?: number;
  sampleCount?: number;
  trend?: string;
  trendDelta?: number;
  modelsPresent?: string;
  confidenceWidth?: number;
  latestPredictionDate?: string | null;
  latestCreatedAt?: string | null;
  isPrediction?: boolean;
  isEstimated?: boolean;
}

interface InteractiveMapProps {
  hotspots: Hotspot[];
  onHotspotClick?: (hotspot: Hotspot) => void;
}

type LayerType = 'ocean' | 'satellite' | 'street';

const INTENSITY_HEX: Record<Hotspot['intensity'], string> = {
  Critical: '#dc2626',
  High: '#f97316',
  Moderate: '#d97706',
  Low: '#059669',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmt(value: number | undefined, digits = 1): string {
  return value == null || Number.isNaN(value) ? 'N/A' : value.toFixed(digits);
}

function popupRow(label: string, value: string, color?: string) {
  return `
    <div style="display:flex;justify-content:space-between;gap:16px;margin:3px 0;">
      <span style="font-size:12px;color:#64748b;">${label}</span>
      <span style="font-size:12px;font-weight:650;color:${color || '#334155'};text-align:right;">${value}</span>
    </div>
  `;
}

function buildPopup(hotspot: Hotspot, color: string) {
  const score = hotspot.pollutionScore != null ? `${(hotspot.pollutionScore * 100).toFixed(1)}%` : 'N/A';
  const trend = hotspot.trend
    ? `${escapeHtml(hotspot.trend)}${hotspot.trendDelta != null ? ` (${hotspot.trendDelta > 0 ? '+' : ''}${hotspot.trendDelta.toFixed(1)})` : ''}`
    : 'N/A';
  const badges = [
    hotspot.isPrediction ? '<span style="background:#0f766e;color:white;font-size:10px;font-weight:700;padding:3px 7px;border-radius:999px;">Forecast</span>' : '',
    hotspot.isEstimated ? '<span style="background:#64748b;color:white;font-size:10px;font-weight:700;padding:3px 7px;border-radius:999px;">Reference</span>' : '',
  ].filter(Boolean).join(' ');

  return `
    <div style="min-width:230px;padding:10px;font-family:Inter,system-ui,-apple-system,sans-serif;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;font-weight:800;">OceanGuard</div>
        <div>${badges}</div>
      </div>
      <h3 style="font-weight:800;font-size:15px;color:#0f3a52;margin:0 0 3px;">${escapeHtml(hotspot.name)}</h3>
      <p style="font-size:12px;color:#64748b;margin:0 0 9px;">${escapeHtml(hotspot.location)}</p>
      ${popupRow('Intensity', escapeHtml(hotspot.intensity), color)}
      ${popupRow('Pollution score', score, color)}
      ${popupRow('Avg level', `${fmt(hotspot.avgPollutionLevel)} / 100`)}
      ${popupRow('Range', `${fmt(hotspot.minPollutionLevel)} - ${fmt(hotspot.maxPollutionLevel)}`)}
      ${popupRow('Trend', trend)}
      ${popupRow('Models', escapeHtml(hotspot.modelsPresent || 'Reference'))}
      ${popupRow('Samples', String(hotspot.sampleCount ?? 0))}
      ${popupRow('CI width', fmt(hotspot.confidenceWidth))}
      ${popupRow('Density', escapeHtml(hotspot.plasticDensity))}
      ${popupRow('Coordinates', escapeHtml(hotspot.coordinates))}
    </div>
  `;
}

export function InteractiveMap({ hotspots, onHotspotClick }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, { circle: L.Circle; marker: L.Marker }>>(new Map());
  const layersRef = useRef<Record<LayerType, L.TileLayer> | null>(null);
  const [currentLayer, setCurrentLayer] = useState<LayerType>('ocean');

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [18, 8],
      zoom: 2,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    });

    const oceanLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri, GEBCO, NOAA, National Geographic',
      maxZoom: 16,
    });
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri, Maxar, Earthstar Geographics',
      maxZoom: 18,
    });
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors',
      maxZoom: 18,
    });

    oceanLayer.addTo(map);
    layersRef.current = { ocean: oceanLayer, satellite: satelliteLayer, street: streetLayer };
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current.clear();
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const existingMarkers = markersRef.current;
    const activeIds = new Set(hotspots.map(h => `${h.name}-${h.lat}-${h.lng}`));

    existingMarkers.forEach((layers, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(layers.circle);
        map.removeLayer(layers.marker);
        existingMarkers.delete(id);
      }
    });

    hotspots.forEach((hotspot) => {
      const markerId = `${hotspot.name}-${hotspot.lat}-${hotspot.lng}`;
      const color = INTENSITY_HEX[hotspot.intensity] || '#0891b2';
      const score = hotspot.pollutionScore ?? Math.max(0.2, Math.min((hotspot.avgPollutionLevel ?? 40) / 100, 1));
      const sampleWeight = Math.min((hotspot.sampleCount ?? 0) / 60, 1);
      const radius = Math.round(28000 + score * 110000 + sampleWeight * 18000);
      const fillOpacity = hotspot.isEstimated ? 0.1 : hotspot.isPrediction ? 0.22 : 0.34;
      const popupContent = buildPopup(hotspot, color);

      const existing = existingMarkers.get(markerId);
      if (existing) {
        existing.circle.setLatLng([hotspot.lat, hotspot.lng]);
        existing.circle.setRadius(radius);
        existing.circle.setStyle({
          color,
          fillColor: color,
          fillOpacity,
          opacity: hotspot.isEstimated ? 0.6 : 0.95,
          dashArray: hotspot.isPrediction || hotspot.isEstimated ? '7 5' : undefined,
        });
        existing.circle.setPopupContent(popupContent);
        existing.marker.setLatLng([hotspot.lat, hotspot.lng]);
        existing.marker.setPopupContent(popupContent);
        return;
      }

      const circle = L.circle([hotspot.lat, hotspot.lng], {
        color,
        fillColor: color,
        fillOpacity,
        radius,
        weight: hotspot.isEstimated ? 1 : 2,
        opacity: hotspot.isEstimated ? 0.6 : 0.95,
        dashArray: hotspot.isPrediction || hotspot.isEstimated ? '7 5' : undefined,
      }).addTo(map);

      const marker = L.marker([hotspot.lat, hotspot.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="background:${color};width:14px;height:14px;border-radius:999px;border:2px solid white;box-shadow:0 5px 14px rgba(15,58,82,.35);outline:2px solid ${color}55;"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      circle.bindPopup(popupContent);
      marker.bindPopup(popupContent);
      circle.on('click', () => onHotspotClick?.(hotspot));
      marker.on('click', () => onHotspotClick?.(hotspot));
      existingMarkers.set(markerId, { circle, marker });
    });

    if (hotspots.length >= 2) {
      const bounds = L.latLngBounds(hotspots.map(h => [h.lat, h.lng] as L.LatLngTuple));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 4 });
    } else if (hotspots.length === 1) {
      map.setView([hotspots[0].lat, hotspots[0].lng], 3);
    }
  }, [hotspots, onHotspotClick]);

  const switchLayer = (layerType: LayerType) => {
    const map = mapInstanceRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    Object.values(layers).forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    layers[layerType].addTo(map);
    setCurrentLayer(layerType);
  };

  const resetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (hotspots.length >= 2) {
      const bounds = L.latLngBounds(hotspots.map(h => [h.lat, h.lng] as L.LatLngTuple));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 4 });
    } else {
      map.setView([18, 8], 2);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden bg-slate-100" />

      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col gap-2 z-[1000]">
        <Card className="glass-card border-white/70">
          <CardContent className="p-2">
            <div className="flex flex-col gap-1">
              {(['ocean', 'satellite', 'street'] as LayerType[]).map(layer => (
                <Button
                  key={layer}
                  variant={currentLayer === layer ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => switchLayer(layer)}
                  className="justify-start text-[11px] sm:text-xs h-8 capitalize"
                >
                  {layer}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/70">
          <CardContent className="p-2">
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="sm" onClick={() => mapInstanceRef.current?.zoomIn()} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mapInstanceRef.current?.zoomOut()} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={resetView} title="Reset view">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card absolute bottom-2 left-2 right-2 z-[1000] sm:bottom-4 sm:left-4 sm:right-auto border-white/70">
        <CardContent className="p-2.5 sm:p-4">
          <h4 className="text-xs sm:text-sm font-semibold mb-2">Pollution Intensity</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:block sm:space-y-1">
            {Object.entries(INTENSITY_HEX).map(([label, color]) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground">
            Circle size reflects pollution score and sample depth.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
