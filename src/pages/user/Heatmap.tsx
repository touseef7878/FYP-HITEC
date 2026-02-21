import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import logger from '@/utils/logger';
import { MapPin, Layers, Info, Database, RefreshCw, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { dataService } from "@/services/data.service";
import { useToast } from "@/hooks/use-toast";
import { InteractiveMap, Hotspot } from "@/components/features/heatmap/InteractiveMap";

// Known marine pollution hotspots with real coordinates
const GLOBAL_HOTSPOTS: Hotspot[] = [
  {
    name: "Great Pacific Garbage Patch",
    location: "North Pacific Ocean",
    coordinates: "37°N 145°W",
    intensity: "Critical",
    plasticDensity: "1.8M pieces/km²",
    color: "bg-destructive",
    lat: 37.0,
    lng: -145.0,
    detectionCount: 2847
  },
  {
    name: "Southeast Asian Waters",
    location: "South China Sea",
    coordinates: "15°N 115°E",
    intensity: "High",
    plasticDensity: "580K pieces/km²",
    color: "bg-warning",
    lat: 15.0,
    lng: 115.0,
    detectionCount: 1523
  },
  {
    name: "Mediterranean Pollution Zone",
    location: "Mediterranean Sea",
    coordinates: "36°N 18°E",
    intensity: "Moderate",
    plasticDensity: "247K pieces/km²",
    color: "bg-chart-5",
    lat: 36.0,
    lng: 18.0,
    detectionCount: 892
  },
  {
    name: "Indian Ocean Gyre",
    location: "Indian Ocean",
    coordinates: "25°S 75°E",
    intensity: "High",
    plasticDensity: "412K pieces/km²",
    color: "bg-warning",
    lat: -25.0,
    lng: 75.0,
    detectionCount: 1247
  },
  {
    name: "North Atlantic Gyre",
    location: "North Atlantic Ocean",
    coordinates: "40°N 40°W",
    intensity: "Moderate",
    plasticDensity: "325K pieces/km²",
    color: "bg-chart-5",
    lat: 40.0,
    lng: -40.0,
    detectionCount: 756
  },
  {
    name: "Caribbean Pollution Zone",
    location: "Caribbean Sea",
    coordinates: "18°N 75°W",
    intensity: "High",
    plasticDensity: "467K pieces/km²",
    color: "bg-warning",
    lat: 18.0,
    lng: -75.0,
    detectionCount: 1089
  }
];

export default function HeatmapPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showGlobalData, setShowGlobalData] = useState(false);
  const { toast } = useToast();

  const loadHotspotData = () => {
    try {
      const userHotspots = dataService.getHotspots();
      
      // Convert user hotspots to map format with random coordinates if not provided
      const mappedUserHotspots: Hotspot[] = userHotspots.map((hotspot, index) => ({
        ...hotspot,
        lat: 20 + (Math.random() - 0.5) * 60, // Random lat between -10 and 50
        lng: (Math.random() - 0.5) * 360, // Random lng between -180 and 180
        detectionCount: Math.floor(Math.random() * 100) + 10
      }));

      if (showGlobalData) {
        setHotspots([...GLOBAL_HOTSPOTS, ...mappedUserHotspots]);
      } else {
        setHotspots(mappedUserHotspots);
      }
    } catch (error) {
      logger.error('Error loading hotspot data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load hotspot data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHotspotData();
  }, [showGlobalData]);

  const handleRefresh = () => {
    setIsLoading(true);
    loadHotspotData();
    toast({
      title: "Data Refreshed",
      description: "Hotspot data has been updated",
    });
  };

  const handleAddSampleHotspot = () => {
    const sampleHotspots = [
      {
        name: `Detection Zone ${Date.now()}`,
        location: "Marine Region",
        coordinates: "Unknown",
        intensity: "Moderate" as const,
        plasticDensity: `${Math.floor(Math.random() * 500) + 100}K pieces/km²`,
        color: "bg-chart-5"
      }
    ];

    sampleHotspots.forEach(hotspot => {
      dataService.getHotspots().push(hotspot);
    });

    localStorage.setItem('pollutionHotspots', JSON.stringify(dataService.getHotspots()));
    loadHotspotData();
    
    toast({
      title: "Sample Hotspot Added",
      description: "A new pollution zone has been added to the map",
    });
  };

  const handleClearUserHotspots = () => {
    localStorage.removeItem('pollutionHotspots');
    loadHotspotData();
    
    toast({
      title: "User Hotspots Cleared",
      description: "All user-generated hotspots have been removed",
    });
  };

  const handleHotspotClick = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
  };

  const criticalZones = hotspots.filter(spot => spot.intensity === "Critical").length;
  const highRiskZones = hotspots.filter(spot => spot.intensity === "High").length;
  const moderateZones = hotspots.filter(spot => spot.intensity === "Moderate").length;
  const lowRiskZones = hotspots.filter(spot => spot.intensity === "Low").length;

  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="mb-8">
            <h1 className="section-header">Pollution Heatmap</h1>
            <p className="text-muted-foreground">
              Interactive visualization of marine plastic pollution zones worldwide
            </p>
          </div>
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading heatmap data...</p>
            </CardContent>
          </Card>
        </PageTransition>
      </MainLayout>
    );
  }
  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="section-header">Pollution Heatmap</h1>
            <p className="text-muted-foreground">
              Interactive visualization of marine plastic pollution zones worldwide
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowGlobalData(!showGlobalData)}
              variant={showGlobalData ? "default" : "outline"}
            >
              <Layers className="h-4 w-4 mr-2" />
              {showGlobalData ? "Hide Global" : "Show Global"}
            </Button>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map Container */}
          <div className="lg:col-span-3">
            <Card className="glass-card h-[600px] overflow-hidden">
              <CardContent className="p-0 h-full">
                {hotspots.length > 0 ? (
                  <InteractiveMap 
                    hotspots={hotspots} 
                    onHotspotClick={handleHotspotClick}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/20 to-secondary/20">
                    <div className="text-center">
                      <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Hotspots Available</h3>
                      <p className="text-muted-foreground text-sm max-w-xs mb-4">
                        Perform some detections or add sample data to see pollution hotspots
                      </p>
                      <Button onClick={handleAddSampleHotspot}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Sample Hotspot
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected Hotspot Details */}
            {selectedHotspot && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Selected Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">{selectedHotspot.name}</h4>
                      <p className="text-sm text-muted-foreground">{selectedHotspot.location}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Intensity:</span>
                        <Badge className={selectedHotspot.color}>
                          {selectedHotspot.intensity}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Density:</span>
                        <span className="text-sm font-medium">{selectedHotspot.plasticDensity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Coordinates:</span>
                        <span className="text-sm">{selectedHotspot.coordinates}</span>
                      </div>
                      {selectedHotspot.detectionCount && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Detections:</span>
                          <span className="text-sm font-medium">{selectedHotspot.detectionCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hotspots List */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Pollution Zones ({hotspots.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hotspots.length === 0 ? (
                  <div className="py-8 text-center">
                    <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">
                      No hotspot data available
                    </p>
                    <div className="space-y-2">
                      <Button onClick={handleAddSampleHotspot} size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Sample Data
                      </Button>
                      <Button 
                        onClick={() => setShowGlobalData(true)} 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                      >
                        <Layers className="h-4 w-4 mr-2" />
                        Show Global Hotspots
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {hotspots.slice(0, 10).map((spot, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                          selectedHotspot?.name === spot.name ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedHotspot(spot)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{spot.name}</h4>
                          <Badge className={`${spot.color} text-white text-xs`}>
                            {spot.intensity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {spot.location}
                        </p>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {spot.coordinates}
                          </span>
                          <span className="font-medium">{spot.plasticDensity}</span>
                        </div>
                      </motion.div>
                    ))}
                    {hotspots.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        ... and {hotspots.length - 10} more zones
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Zone Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Zones</span>
                  <span className="font-medium">{hotspots.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Critical Zones</span>
                  <span className="font-medium text-destructive">{criticalZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High Risk Zones</span>
                  <span className="font-medium text-warning">{highRiskZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moderate Zones</span>
                  <span className="font-medium text-chart-5">{moderateZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low Risk Zones</span>
                  <span className="font-medium text-success">{lowRiskZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Points</span>
                  <span className="font-medium">
                    {hotspots.reduce((sum, h) => sum + (h.detectionCount || 0), 0).toLocaleString()}
                  </span>
                </div>
                
                {/* Data Management */}
                <div className="pt-3 border-t space-y-2">
                  <Button 
                    onClick={handleAddSampleHotspot} 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sample Zone
                  </Button>
                  {dataService.getHotspots().length > 0 && (
                    <Button 
                      onClick={handleClearUserHotspots} 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear User Zones
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
