import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import logger from '@/utils/logger';
import { MapPin, Layers, Info, Database, RefreshCw, Clock, TrendingUp, AlertTriangle, Activity, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { InteractiveMap, Hotspot } from "@/components/features/heatmap/InteractiveMap";
import ENV from "@/config/env";

const API_URL = ENV.API_URL;
const REGIONS = ["pacific", "atlantic", "indian", "mediterranean"] as const;

type TimeRange = "1d" | "7d" | "30d" | "90d";
type HeatmapMode = "current" | "predicted";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1d": "Last 24h",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
};

const INTENSITY_COLORS: Record<string, string> = {
  Critical: "bg-destructive",
  High: "bg-orange-500",
  Moderate: "bg-yellow-500",
  Low: "bg-green-500",
};

// Fallback static hotspots shown when backend is unreachable
const FALLBACK_HOTSPOTS: Hotspot[] = [
  { name: "Great Pacific Garbage Patch", location: "North Pacific Ocean", coordinates: "37°N 145°W", intensity: "Critical", plasticDensity: "1.8M pieces/km²", color: "bg-destructive", lat: 37.0, lng: -145.0, detectionCount: 2847 },
  { name: "Southeast Asian Waters", location: "South China Sea", coordinates: "15°N 115°E", intensity: "High", plasticDensity: "580K pieces/km²", color: "bg-warning", lat: 15.0, lng: 115.0, detectionCount: 1523 },
  { name: "Mediterranean Pollution Zone", location: "Mediterranean Sea", coordinates: "36°N 18°E", intensity: "Moderate", plasticDensity: "247K pieces/km²", color: "bg-chart-5", lat: 36.0, lng: 18.0, detectionCount: 892 },
  { name: "Indian Ocean Gyre", location: "Indian Ocean", coordinates: "25°S 75°E", intensity: "High", plasticDensity: "412K pieces/km²", color: "bg-warning", lat: -25.0, lng: 75.0, detectionCount: 1247 },
  { name: "North Atlantic Gyre", location: "North Atlantic Ocean", coordinates: "40°N 40°W", intensity: "Moderate", plasticDensity: "325K pieces/km²", color: "bg-chart-5", lat: 40.0, lng: -40.0, detectionCount: 756 },
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function mapApiHotspot(item: any): Hotspot {
  return {
    name: item.name ?? item.region,
    location: item.location ?? item.region,
    coordinates: item.coordinates ?? `${item.lat}°, ${item.lng}°`,
    intensity: item.intensity as Hotspot["intensity"],
    plasticDensity: item.plasticDensity ?? "N/A",
    color: INTENSITY_COLORS[item.intensity] ?? "bg-chart-5",
    lat: item.lat,
    lng: item.lng,
    detectionCount: item.sample_count || undefined,
    pollutionScore: item.pollution_score,
    avgPollutionLevel: item.avg_pollution_level,
    sampleCount: item.sample_count,
    isPrediction: item.is_prediction ?? false,
    isEstimated: item.is_estimated ?? false,
  };
}

export default function HeatmapPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [mode, setMode] = useState<HeatmapMode>("current");
  const [usingFallback, setUsingFallback] = useState(false);

  // Fetch-data cooldown state
  const [isFetching, setIsFetching] = useState(false);
  // secondsRemaining per region — we use the minimum across all regions for the button
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [canFetch, setCanFetch] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();

  // ── helpers ──────────────────────────────────────────────────────────────

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  });

  const loadFetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/data/fetch-status`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      // Button is enabled only when ALL regions can be fetched
      const statuses: Record<string, any> = data.regions ?? {};
      const maxRemaining = Math.max(0, ...Object.values(statuses).map((s: any) => s.seconds_remaining ?? 0));
      const allCanFetch = Object.values(statuses).every((s: any) => s.can_fetch);
      setCooldownSeconds(maxRemaining);
      setCanFetch(allCanFetch);

      // Start/reset countdown ticker
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (maxRemaining > 0) {
        let remaining = maxRemaining;
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setCooldownSeconds(remaining);
          if (remaining <= 0) {
            clearInterval(countdownRef.current!);
            setCanFetch(true);
          }
        }, 1000);
      }
    } catch (e) {
      logger.error("fetch-status error", e);
    }
  }, []);

  const fetchHeatmap = useCallback(async (range: TimeRange, heatmapMode: HeatmapMode) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/heatmap?range=${range}&mode=${heatmapMode}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.hotspots && data.hotspots.length > 0) {
        setHotspots(data.hotspots.map(mapApiHotspot));
        setUsingFallback(false);
      } else {
        setHotspots(FALLBACK_HOTSPOTS);
        setUsingFallback(true);
      }
    } catch (err) {
      logger.error("Heatmap fetch error:", err);
      setHotspots(FALLBACK_HOTSPOTS);
      setUsingFallback(true);
      toast({ title: "Using Offline Data", description: "Could not reach backend.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleFetchFreshData = async () => {
    if (!canFetch || isFetching) return;
    setIsFetching(true);
    toast({ title: "Fetching Fresh Data", description: "Fetching environmental data for all regions…" });

    let anySuccess = false;
    for (const region of REGIONS) {
      try {
        const res = await fetch(`${API_URL}/api/data/fetch`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ region }),
        });
        const data = await res.json();
        if (data.success) anySuccess = true;
        else if (data.message === "cooldown_active") {
          toast({
            title: `${region} on cooldown`,
            description: `Next fetch in ${formatCountdown(data.seconds_remaining)}`,
            variant: "destructive",
          });
        }
      } catch (e) {
        logger.error(`Fetch failed for ${region}`, e);
      }
    }

    setIsFetching(false);
    await loadFetchStatus();

    if (anySuccess) {
      toast({ title: "Data Updated", description: "Fresh environmental data fetched. Refreshing map…" });
      fetchHeatmap(timeRange, mode);
    }
  };

  // ── lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    loadFetchStatus();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [loadFetchStatus]);

  useEffect(() => {
    fetchHeatmap(timeRange, mode);
  }, [timeRange, mode, fetchHeatmap]);

  // ── derived ───────────────────────────────────────────────────────────────

  const criticalZones = hotspots.filter(h => h.intensity === "Critical").length;
  const highRiskZones = hotspots.filter(h => h.intensity === "High").length;
  const moderateZones = hotspots.filter(h => h.intensity === "Moderate").length;
  const lowRiskZones  = hotspots.filter(h => h.intensity === "Low").length;
  const avgScore = hotspots.length
    ? hotspots.reduce((s, h) => s + (h.pollutionScore ?? 0), 0) / hotspots.length
    : 0;

  return (
    <MainLayout>
      <PageTransition className="page-container">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-header">Pollution Heatmap</h1>
            <p className="text-muted-foreground text-sm">
              {mode === "predicted"
                ? "LSTM-predicted future pollution intensity by ocean region"
                : "Aggregated pollution scores from LSTM model predictions"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Mode toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <Button
                size="sm"
                variant={mode === "current" ? "default" : "ghost"}
                className="rounded-none"
                onClick={() => setMode("current")}
              >
                <Activity className="h-3.5 w-3.5 mr-1" />
                Current
              </Button>
              <Button
                size="sm"
                variant={mode === "predicted" ? "default" : "ghost"}
                className="rounded-none"
                onClick={() => setMode("predicted")}
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Predicted
              </Button>
            </div>

            {/* Time range (only relevant for current mode) */}
            {mode === "current" && (
              <div className="flex rounded-md border overflow-hidden">
                {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={timeRange === r ? "default" : "ghost"}
                    className="rounded-none text-xs px-2"
                    onClick={() => setTimeRange(r)}
                  >
                    {TIME_RANGE_LABELS[r]}
                  </Button>
                ))}
              </div>
            )}

            {/* Fetch fresh data — 1-hour cooldown */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleFetchFreshData}
              disabled={!canFetch || isFetching}
              title={!canFetch ? `Next fetch available in ${formatCountdown(cooldownSeconds)}` : "Fetch fresh environmental data"}
            >
              <Download className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-bounce" : ""}`} />
              {isFetching
                ? "Fetching…"
                : canFetch
                  ? "Fetch Data"
                  : `Fetch Data (${formatCountdown(cooldownSeconds)})`}
            </Button>

            <Button size="sm" variant="outline" onClick={() => fetchHeatmap(timeRange, mode)} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Fallback notice */}
        {usingFallback && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            Backend unreachable. Showing reference hotspots only.
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="glass-card h-[600px] overflow-hidden">
              <CardContent className="p-0 h-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Loading heatmap data…</p>
                    </div>
                  </div>
                ) : (
                  <InteractiveMap hotspots={hotspots} onHotspotClick={setSelectedHotspot} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected zone detail */}
            {selectedHotspot && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Selected Zone
                    {selectedHotspot.isPrediction && (
                      <Badge className="bg-indigo-500 text-white text-xs ml-auto">Predicted</Badge>
                    )}
                    {(selectedHotspot as any).isEstimated && (
                      <Badge className="bg-stone-500 text-white text-xs ml-auto">Baseline Est.</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{selectedHotspot.name}</p>
                  <p className="text-muted-foreground">{selectedHotspot.location}</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Intensity</span>
                    <Badge className={selectedHotspot.color}>{selectedHotspot.intensity}</Badge>
                  </div>
                  {selectedHotspot.pollutionScore != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pollution Score</span>
                      <span className="font-semibold">{(selectedHotspot.pollutionScore * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {selectedHotspot.avgPollutionLevel != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Level</span>
                      <span className="font-medium">{selectedHotspot.avgPollutionLevel.toFixed(1)} / 100</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Density</span>
                    <span className="font-medium">{selectedHotspot.plasticDensity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coordinates</span>
                    <span>{selectedHotspot.coordinates}</span>
                  </div>
                  {selectedHotspot.sampleCount != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Points</span>
                      <span className="font-medium">{selectedHotspot.sampleCount}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Zone list */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Pollution Zones ({hotspots.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hotspots.length === 0 ? (
                  <div className="py-6 text-center">
                    <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {hotspots.map((spot, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                          selectedHotspot?.name === spot.name ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedHotspot(spot)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-medium text-xs leading-tight">{spot.name}</span>
                          <div className="flex items-center gap-1 ml-1 shrink-0">
                            {(spot as any).isEstimated && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded">Est.</span>
                            )}
                            <Badge className={`${spot.color} text-white text-xs`}>
                              {spot.intensity}
                            </Badge>
                          </div>
                        </div>
                        {spot.pollutionScore != null && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${spot.pollutionScore * 100}%`,
                                  backgroundColor:
                                    spot.intensity === "Critical" ? "#ef4444"
                                    : spot.intensity === "High" ? "#f59e0b"
                                    : spot.intensity === "Moderate" ? "#eab308"
                                    : "#10b981",
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {(spot.pollutionScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Zone Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Zones</span>
                  <span className="font-medium">{hotspots.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Critical</span>
                  <span className="font-medium text-destructive">{criticalZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High Risk</span>
                  <span className="font-medium text-orange-500">{highRiskZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moderate</span>
                  <span className="font-medium text-yellow-500">{moderateZones}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low Risk</span>
                  <span className="font-medium text-green-500">{lowRiskZones}</span>
                </div>
                {!usingFallback && (
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">Avg Pollution Score</span>
                    <span className="font-semibold">{(avgScore * 100).toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Source</span>
                  <span className="font-medium text-xs">
                    {usingFallback ? "Reference" : mode === "predicted" ? "LSTM Model" : "DB Predictions"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
