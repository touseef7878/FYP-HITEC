import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// Fix for default markers in Leaflet with Vite
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
  intensity: "Critical" | "High" | "Moderate" | "Low";
  plasticDensity: string;
  color: string;
  lat: number;
  lng: number;
  detectionCount?: number;
  // heatmap-specific fields
  pollutionScore?: number;       // 0-1 normalised score
  avgPollutionLevel?: number;    // raw 0-100 level
  sampleCount?: number;
  isPrediction?: boolean;
  isEstimated?: boolean;   // true = no DB data, using research baseline
}

interface InteractiveMapProps {
  hotspots: Hotspot[];
  onHotspotClick?: (hotspot: Hotspot) => void;
}

export function InteractiveMap({ hotspots, onHotspotClick }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, { circle: L.Circle; marker: L.Marker }>>(new Map());
  const layersRef = useRef<Record<string, L.TileLayer>>({});
  const [currentLayer, setCurrentLayer] = useState<'satellite' | 'street' | 'ocean'>('ocean');

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [20, 0], // Center on equator
      zoom: 2,
      zoomControl: false,
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    // Add tile layers
    const oceanLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, GEBCO, NOAA, National Geographic, DeLorme, HERE, Geonames.org',
      maxZoom: 16,
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
      maxZoom: 18,
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    });

    // Add default layer
    oceanLayer.addTo(map);

    // Store layers in ref (not on map internals)
    layersRef.current = { ocean: oceanLayer, satellite: satelliteLayer, street: streetLayer };

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  // OPTIMIZED: Only update changed markers instead of redrawing all
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const existingMarkers = markersRef.current;
    const newMarkerIds = new Set(hotspots.map(h => `${h.lat}-${h.lng}`));

    // Remove markers that no longer exist
    existingMarkers.forEach((layers, id) => {
      if (!newMarkerIds.has(id)) {
        map.removeLayer(layers.circle);
        map.removeLayer(layers.marker);
        existingMarkers.delete(id);
      }
    });

    // Add or update markers
    hotspots.forEach((hotspot) => {
      const markerId = `${hotspot.lat}-${hotspot.lng}`;
      const intensity = hotspot.intensity.toLowerCase();
      let color = '#10b981';
      // Base radius; scale up if we have a pollution score
      const scoreMultiplier = hotspot.pollutionScore != null ? 0.5 + hotspot.pollutionScore * 1.5 : 1;
      let baseRadius = 50000;

      switch (intensity) {
        case 'critical': color = '#ef4444'; baseRadius = 100000; break;
        case 'high':     color = '#f59e0b'; baseRadius = 75000;  break;
        case 'moderate': color = '#eab308'; baseRadius = 50000;  break;
        case 'low':      color = '#10b981'; baseRadius = 25000;  break;
      }

      const radius = Math.round(baseRadius * scoreMultiplier);

      // Check if marker already exists
      const existing = existingMarkers.get(markerId);
      
      if (!existing) {
        const predictionBadge = hotspot.isPrediction
          ? `<div style="background:#6366f1;color:white;font-size:10px;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:6px;">🔮 LSTM Prediction</div>`
          : '';

        const estimatedBadge = hotspot.isEstimated
          ? `<div style="background:#78716c;color:white;font-size:10px;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:6px;margin-left:4px;">📊 Baseline Estimate</div>`
          : '';

        const scoreRow = hotspot.pollutionScore != null
          ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">
               <span style="font-size:13px;">Pollution Score:</span>
               <span style="font-size:13px;font-weight:bold;color:${color}">${(hotspot.pollutionScore * 100).toFixed(1)}%</span>
             </div>`
          : '';

        const levelRow = hotspot.avgPollutionLevel != null
          ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">
               <span style="font-size:13px;">Avg Level:</span>
               <span style="font-size:13px;font-weight:500;">${hotspot.avgPollutionLevel.toFixed(1)} / 100</span>
             </div>`
          : '';

        const samplesRow = (hotspot.sampleCount != null && hotspot.sampleCount > 0)
          ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">
               <span style="font-size:13px;">Data Points:</span>
               <span style="font-size:13px;font-weight:500;">${hotspot.sampleCount}</span>
             </div>`
          : '';

        // Create new marker
        const circle = L.circle([hotspot.lat, hotspot.lng], {
          color: color,
          fillColor: color,
          fillOpacity: hotspot.isPrediction ? 0.15 : 0.3,
          radius: radius,
          weight: hotspot.isPrediction ? 1 : 2,
          dashArray: hotspot.isPrediction ? '6 4' : undefined,
        }).addTo(map);

        const popupContent = `
          <div style="padding:8px;min-width:200px;">
            <div style="margin-bottom:6px;">${predictionBadge}${estimatedBadge}</div>
            <h3 style="font-weight:700;font-size:15px;margin-bottom:4px;">${hotspot.name}</h3>
            <p style="font-size:12px;color:#6b7280;margin-bottom:8px;">${hotspot.location}</p>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span style="font-size:13px;">Intensity:</span>
                <span style="font-size:13px;font-weight:600;color:${color}">${hotspot.intensity}</span>
              </div>
              ${scoreRow}
              ${levelRow}
              ${samplesRow}
              <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span style="font-size:13px;">Density:</span>
                <span style="font-size:13px;font-weight:500;">${hotspot.plasticDensity}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="font-size:13px;">Coordinates:</span>
                <span style="font-size:13px;">${hotspot.coordinates}</span>
              </div>
            </div>
          </div>
        `;

        circle.bindPopup(popupContent);
        circle.on('click', () => {
          if (onHotspotClick) {
            onHotspotClick(hotspot);
          }
        });

        const marker = L.marker([hotspot.lat, hotspot.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        }).addTo(map);

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          if (onHotspotClick) {
            onHotspotClick(hotspot);
          }
        });

        existingMarkers.set(markerId, { circle, marker });
      }
    });

    // Fit map to show all hotspots if there are multiple spread-out points
    if (hotspots.length >= 2) {
      const bounds = L.latLngBounds(hotspots.map(h => [h.lat, h.lng] as L.LatLngTuple));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 4 });
    } else if (hotspots.length === 1) {
      map.setView([hotspots[0].lat, hotspots[0].lng], 3);
    }
  }, [hotspots]);

  const switchLayer = (layerType: 'satellite' | 'street' | 'ocean') => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const layers = layersRef.current;

    Object.values(layers).forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });

    layers[layerType].addTo(map);
    setCurrentLayer(layerType);
  };

  const zoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const zoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const resetView = () => {
    if (!mapInstanceRef.current) return;
    if (hotspots.length >= 2) {
      const bounds = L.latLngBounds(hotspots.map(h => [h.lat, h.lng] as L.LatLngTuple));
      mapInstanceRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 4 });
    } else {
      mapInstanceRef.current.setView([20, 0], 2);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        {/* Layer Switcher */}
        <Card className="glass-card">
          <CardContent className="p-2">
            <div className="flex flex-col gap-1">
              <Button
                variant={currentLayer === 'ocean' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => switchLayer('ocean')}
                className="justify-start text-xs"
              >
                Ocean
              </Button>
              <Button
                variant={currentLayer === 'satellite' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => switchLayer('satellite')}
                className="justify-start text-xs"
              >
                Satellite
              </Button>
              <Button
                variant={currentLayer === 'street' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => switchLayer('street')}
                className="justify-start text-xs"
              >
                Street
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Zoom Controls */}
        <Card className="glass-card">
          <CardContent className="p-2">
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="sm" onClick={zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={resetView}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="glass-card absolute bottom-4 left-4 z-[1000]">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-2">Pollution Intensity</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-xs">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500" />
              <span className="text-xs">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500" />
              <span className="text-xs">Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-xs">Low</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}