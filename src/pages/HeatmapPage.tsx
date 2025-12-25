import { motion } from "framer-motion";
import { MapPin, Layers, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";

// Sample pollution hotspots data
const hotspots = [
  {
    name: "Great Pacific Garbage Patch",
    location: "North Pacific Ocean",
    coordinates: "37°N 145°W",
    intensity: "Critical",
    plasticDensity: "1.8M pieces/km²",
    color: "bg-destructive",
  },
  {
    name: "Southeast Asian Waters",
    location: "South China Sea",
    coordinates: "15°N 115°E",
    intensity: "High",
    plasticDensity: "580K pieces/km²",
    color: "bg-warning",
  },
  {
    name: "Mediterranean Pollution Zone",
    location: "Mediterranean Sea",
    coordinates: "36°N 18°E",
    intensity: "Moderate",
    plasticDensity: "247K pieces/km²",
    color: "bg-chart-5",
  },
  {
    name: "Indian Ocean Gyre",
    location: "Indian Ocean",
    coordinates: "25°S 75°E",
    intensity: "High",
    plasticDensity: "412K pieces/km²",
    color: "bg-warning",
  },
];

export default function HeatmapPage() {
  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-8">
          <h1 className="section-header">Pollution Heatmap</h1>
          <p className="text-muted-foreground">
            Interactive visualization of marine plastic pollution zones worldwide
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map Container */}
          <div className="lg:col-span-2">
            <Card className="glass-card h-[500px] overflow-hidden">
              <CardContent className="p-0 h-full relative">
                {/* Placeholder for Leaflet Map */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <div className="text-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-24 h-24 rounded-full ocean-gradient mx-auto mb-4 flex items-center justify-center"
                    >
                      <MapPin className="h-12 w-12 text-white" />
                    </motion.div>
                    <h3 className="text-lg font-semibold mb-2">Interactive Map</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Leaflet map with pollution heatmap layer will be rendered here
                    </p>
                  </div>
                </div>

                {/* Map Controls Overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <Card className="glass-card">
                    <CardContent className="p-2">
                      <button className="p-2 hover:bg-muted rounded transition-colors">
                        <Layers className="h-5 w-5" />
                      </button>
                    </CardContent>
                  </Card>
                </div>

                {/* Legend */}
                <Card className="glass-card absolute bottom-4 left-4">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2">Intensity Scale</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-destructive" />
                        <span className="text-xs">Critical</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-warning" />
                        <span className="text-xs">High</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-chart-5" />
                        <span className="text-xs">Moderate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-success" />
                        <span className="text-xs">Low</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          {/* Hotspots Panel */}
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Major Hotspots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {hotspots.map((spot, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{spot.name}</h4>
                      <Badge
                        className={`${spot.color} text-white text-xs`}
                      >
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
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Map Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Hotspots</span>
                  <span className="font-medium">{hotspots.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Critical Zones</span>
                  <span className="font-medium text-destructive">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High Risk Zones</span>
                  <span className="font-medium text-warning">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Points</span>
                  <span className="font-medium">12,847</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
