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
}

interface InteractiveMapProps {
  hotspots: Hotspot[];
  onHotspotClick?: (hotspot: Hotspot) => void;
}

export function InteractiveMap({ hotspots, onHotspotClick }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
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

    // Store layers for switching
    (map as any)._layers = {
      ocean: oceanLayer,
      satellite: satelliteLayer,
      street: streetLayer,
    };

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    // Add hotspot markers
    hotspots.forEach((hotspot) => {
      const intensity = hotspot.intensity.toLowerCase();
      let color = '#10b981'; // Default green
      let radius = 50000; // Default radius in meters

      switch (intensity) {
        case 'critical':
          color = '#ef4444';
          radius = 100000;
          break;
        case 'high':
          color = '#f59e0b';
          radius = 75000;
          break;
        case 'moderate':
          color = '#eab308';
          radius = 50000;
          break;
        case 'low':
          color = '#10b981';
          radius = 25000;
          break;
      }

      // Create circle marker for pollution zone
      const circle = L.circle([hotspot.lat, hotspot.lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        radius: radius,
        weight: 2,
      }).addTo(map);

      // Create popup content
      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-bold text-lg mb-2">${hotspot.name}</h3>
          <p class="text-sm text-gray-600 mb-2">${hotspot.location}</p>
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-sm">Intensity:</span>
              <span class="text-sm font-medium" style="color: ${color}">${hotspot.intensity}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm">Density:</span>
              <span class="text-sm font-medium">${hotspot.plasticDensity}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm">Coordinates:</span>
              <span class="text-sm">${hotspot.coordinates}</span>
            </div>
            ${hotspot.detectionCount ? `
            <div class="flex justify-between">
              <span class="text-sm">Detections:</span>
              <span class="text-sm font-medium">${hotspot.detectionCount}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);

      // Add click handler
      circle.on('click', () => {
        if (onHotspotClick) {
          onHotspotClick(hotspot);
        }
      });

      // Add marker at center
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
    });

    // Fit map to show all hotspots if any exist
    if (hotspots.length > 0) {
      const group = new L.FeatureGroup(
        hotspots.map(h => L.marker([h.lat, h.lng]))
      );
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [hotspots, onHotspotClick]);

  const switchLayer = (layerType: 'satellite' | 'street' | 'ocean') => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const layers = (map as any)._layers;

    // Remove current layer
    Object.values(layers).forEach((layer: any) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // Add new layer
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
    
    if (hotspots.length > 0) {
      const group = new L.FeatureGroup(
        hotspots.map(h => L.marker([h.lat, h.lng]))
      );
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
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