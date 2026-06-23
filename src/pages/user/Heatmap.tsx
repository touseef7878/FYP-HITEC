import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logger from "@/utils/logger";
import { Activity, AlertTriangle, Clock, Database, Download, Info, MapPin, RefreshCw, TrendingUp } from "lucide-react";
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
  "1d": "24h",
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
};

const INTENSITY_COLORS: Record<string, string> = {
  Critical: "bg-red-600",
  High: "bg-orange-500",
  Moderate: "bg-amber-500",
  Low: "bg-emerald-600",
};

const INTENSITY_HEX: Record<string, string> = {
  Critical: "#dc2626",
  High: "#f97316",
  Moderate: "#d97706",
  Low: "#059669",
};

const FALLBACK_HOTSPOTS: Hotspot[] = [
  { name: "Great Pacific Garbage Patch", location: "North Pacific Ocean", coordinates: "37N, 145W", intensity: "Critical", plasticDensity: "1.8M pieces/km2", color: "bg-red-600", lat: 37.0, lng: -145.0, detectionCount: 2847, pollutionScore: 0.92, avgPollutionLevel: 82, maxPollutionLevel: 92, minPollutionLevel: 68, sampleCount: 0, trend: "Reference", modelsPresent: "Reference", isEstimated: true },
  { name: "Southeast Asian Waters", location: "South China Sea", coordinates: "15N, 115E", intensity: "High", plasticDensity: "580K pieces/km2", color: "bg-orange-500", lat: 15.0, lng: 115.0, detectionCount: 1523, pollutionScore: 0.73, avgPollutionLevel: 66, maxPollutionLevel: 78, minPollutionLevel: 51, sampleCount: 0, trend: "Reference", modelsPresent: "Reference", isEstimated: true },
  { name: "Mediterranean Pollution Zone", location: "Mediterranean Sea", coordinates: "36N, 18E", intensity: "Moderate", plasticDensity: "247K pieces/km2", color: "bg-amber-500", lat: 36.0, lng: 18.0, detectionCount: 892, pollutionScore: 0.52, avgPollutionLevel: 46, maxPollutionLevel: 58, minPollutionLevel: 35, sampleCount: 0, trend: "Reference", modelsPresent: "Reference", isEstimated: true },
  { name: "Indian Ocean Gyre", location: "Indian Ocean", coordinates: "25S, 75E", intensity: "High", plasticDensity: "412K pieces/km2", color: "bg-orange-500", lat: -25.0, lng: 75.0, detectionCount: 1247, pollutionScore: 0.68, avgPollutionLevel: 61, maxPollutionLevel: 72, minPollutionLevel: 48, sampleCount: 0, trend: "Reference", modelsPresent: "Reference", isEstimated: true },
  { name: "North Atlantic Gyre", location: "North Atlantic Ocean", coordinates: "40N, 40W", intensity: "Moderate", plasticDensity: "325K pieces/km2", color: "bg-amber-500", lat: 40.0, lng: -40.0, detectionCount: 756, pollutionScore: 0.56, avgPollutionLevel: 49, maxPollutionLevel: 60, minPollutionLevel: 38, sampleCount: 0, trend: "Reference", modelsPresent: "Reference", isEstimated: true },
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString();
}

function mapApiHotspot(item: any): Hotspot {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  return {
    name: item.name ?? item.region,
    location: item.location ?? item.region,
    coordinates: item.coordinates ?? `${lat.toFixed(1)}, ${lng.toFixed(1)}`,
    intensity: item.intensity as Hotspot["intensity"],
    plasticDensity: item.plasticDensity ?? "N/A",
    color: INTENSITY_COLORS[item.intensity] ?? "bg-slate-500",
    lat,
    lng,
    detectionCount: item.sample_count || undefined,
    pollutionScore: item.pollution_score,
    avgPollutionLevel: item.avg_pollution_level,
    maxPollutionLevel: item.max_pollution_level,
    minPollutionLevel: item.min_pollution_level,
    sampleCount: item.sample_count,
    trend: item.trend,
    trendDelta: item.trend_delta,
    modelsPresent: item.models_present,
    confidenceWidth: item.confidence_width,
    latestPredictionDate: item.latest_prediction_date,
    latestCreatedAt: item.latest_created_at,
    isPrediction: item.is_prediction ?? false,
    isEstimated: item.is_estimated ?? false,
  };
}

function StatRow({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-right ${className}`}>{value}</span>
    </div>
  );
}

export default function HeatmapPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [mode, setMode] = useState<HeatmapMode>("current");
  const [usingFallback, setUsingFallback] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [canFetch, setCanFetch] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  });

  const loadFetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/data/fetch-status`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const statuses: Record<string, any> = data.regions ?? {};
      const maxRemaining = Math.max(0, ...Object.values(statuses).map((s: any) => s.seconds_remaining ?? 0));
      const allCanFetch = Object.values(statuses).every((s: any) => s.can_fetch);
      setCooldownSeconds(maxRemaining);
      setCanFetch(allCanFetch);

      if (countdownRef.current) clearInterval(countdownRef.current);
      if (maxRemaining > 0) {
        let remaining = maxRemaining;
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setCooldownSeconds(Math.max(remaining, 0));
          if (remaining <= 0 && countdownRef.current) {
            clearInterval(countdownRef.current);
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
        const mapped = data.hotspots.map(mapApiHotspot);
        setHotspots(mapped);
        setSelectedHotspot(prev => prev ? mapped.find((h: Hotspot) => h.name === prev.name) ?? mapped[0] : mapped[0]);
        setUsingFallback(mapped.every((h: Hotspot) => h.isEstimated));
      } else {
        setHotspots(FALLBACK_HOTSPOTS);
        setSelectedHotspot(FALLBACK_HOTSPOTS[0]);
        setUsingFallback(true);
      }
    } catch (err) {
      logger.error("Heatmap fetch error:", err);
      setHotspots(FALLBACK_HOTSPOTS);
      setSelectedHotspot(FALLBACK_HOTSPOTS[0]);
      setUsingFallback(true);
      toast({ title: "Using Reference Data", description: "Could not reach backend heatmap data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleFetchFreshData = async () => {
    if (!canFetch || isFetching) return;
    setIsFetching(true);
    toast({ title: "Fetching Fresh Data", description: "Refreshing environmental data for all regions..." });

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
      toast({ title: "Data Updated", description: "Fresh environmental data fetched. Refreshing heatmap..." });
      fetchHeatmap(timeRange, mode);
    }
  };

  useEffect(() => {
    loadFetchStatus();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [loadFetchStatus]);

  useEffect(() => {
    fetchHeatmap(timeRange, mode);
  }, [timeRange, mode, fetchHeatmap]);

  const stats = useMemo(() => {
    const counts = { Critical: 0, High: 0, Moderate: 0, Low: 0 };
    hotspots.forEach(h => { counts[h.intensity] += 1; });
    const avgScore = hotspots.length
      ? hotspots.reduce((s, h) => s + (h.pollutionScore ?? 0), 0) / hotspots.length
      : 0;
    const samples = hotspots.reduce((s, h) => s + (h.sampleCount ?? 0), 0);
    const rising = hotspots.filter(h => h.trend === "Increasing").length;
    return { ...counts, avgScore, samples, rising };
  }, [hotspots]);

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-5 sm:mb-6 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="section-header">Pollution Heatmap</h1>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium">
              {mode === "predicted"
                ? "Latest LSTM + GRU forecast intensity by ocean region"
                : "User-scoped pollution scores from saved LSTM + GRU predictions"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <div className="flex rounded-md border overflow-hidden">
              <Button size="sm" variant={mode === "current" ? "default" : "ghost"} className="rounded-none" onClick={() => setMode("current")}>
                <Activity className="h-3.5 w-3.5 mr-1" />
                Current
              </Button>
              <Button size="sm" variant={mode === "predicted" ? "default" : "ghost"} className="rounded-none" onClick={() => setMode("predicted")}>
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Forecast
              </Button>
            </div>

            <div className="flex rounded-md border overflow-hidden">
              {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map(r => (
                <Button key={r} size="sm" variant={timeRange === r ? "default" : "ghost"} className="rounded-none text-xs px-2" onClick={() => setTimeRange(r)}>
                  {TIME_RANGE_LABELS[r]}
                </Button>
              ))}
            </div>

            <Button size="sm" variant="outline" onClick={handleFetchFreshData} disabled={!canFetch || isFetching} title={!canFetch ? `Next fetch available in ${formatCountdown(cooldownSeconds)}` : "Fetch fresh environmental data"}>
              <Download className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-bounce" : ""}`} />
              {isFetching ? "Fetching..." : canFetch ? "Fetch Data" : `Fetch Data (${formatCountdown(cooldownSeconds)})`}
            </Button>

            <Button size="sm" variant="outline" onClick={() => fetchHeatmap(timeRange, mode)} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {usingFallback && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            Showing reference baselines where saved prediction data is unavailable.
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="lg:col-span-3">
            <Card className="glass-card h-[440px] sm:h-[540px] lg:h-[640px] overflow-hidden">
              <CardContent className="p-0 h-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Loading heatmap data...</p>
                    </div>
                  </div>
                ) : (
                  <InteractiveMap hotspots={hotspots} onHotspotClick={setSelectedHotspot} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 min-w-0">
            {selectedHotspot && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Selected Zone
                    {selectedHotspot.isPrediction && <Badge className="bg-teal-700 text-white text-xs ml-auto">Forecast</Badge>}
                    {selectedHotspot.isEstimated && <Badge className="bg-slate-500 text-white text-xs ml-auto">Reference</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-semibold leading-tight">{selectedHotspot.name}</p>
                  <p className="text-muted-foreground">{selectedHotspot.location}</p>
                  <StatRow label="Intensity" value={selectedHotspot.intensity} className={selectedHotspot.intensity === "Critical" ? "text-red-600" : selectedHotspot.intensity === "High" ? "text-orange-500" : selectedHotspot.intensity === "Moderate" ? "text-amber-600" : "text-emerald-600"} />
                  <StatRow label="Pollution Score" value={selectedHotspot.pollutionScore != null ? `${(selectedHotspot.pollutionScore * 100).toFixed(1)}%` : "N/A"} />
                  <StatRow label="Avg Level" value={selectedHotspot.avgPollutionLevel != null ? `${selectedHotspot.avgPollutionLevel.toFixed(1)} / 100` : "N/A"} />
                  <StatRow label="Range" value={`${selectedHotspot.minPollutionLevel != null ? selectedHotspot.minPollutionLevel.toFixed(1) : "N/A"} - ${selectedHotspot.maxPollutionLevel != null ? selectedHotspot.maxPollutionLevel.toFixed(1) : "N/A"}`} />
                  <StatRow label="Trend" value={selectedHotspot.trendDelta != null ? `${selectedHotspot.trend || "Stable"} (${selectedHotspot.trendDelta > 0 ? "+" : ""}${selectedHotspot.trendDelta.toFixed(1)})` : selectedHotspot.trend || "N/A"} />
                  <StatRow label="Models" value={selectedHotspot.modelsPresent || "Reference"} />
                  <StatRow label="CI Width" value={selectedHotspot.confidenceWidth != null ? selectedHotspot.confidenceWidth.toFixed(1) : "N/A"} />
                  <StatRow label="Data Points" value={selectedHotspot.sampleCount ?? 0} />
                  <StatRow label="Latest Forecast" value={formatDate(selectedHotspot.latestPredictionDate)} />
                  <StatRow label="Coordinates" value={selectedHotspot.coordinates} />
                </CardContent>
              </Card>
            )}

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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {hotspots.map((spot, i) => (
                      <motion.div
                        key={`${spot.name}-${spot.lat}-${spot.lng}`}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${selectedHotspot?.name === spot.name ? "ring-2 ring-primary" : ""}`}
                        onClick={() => setSelectedHotspot(spot)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-medium text-xs leading-tight">{spot.name}</span>
                          <div className="flex items-center gap-1 ml-1 shrink-0">
                            {spot.isEstimated && <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded">Ref</span>}
                            <Badge className={`${spot.color} text-white text-xs`}>{spot.intensity}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min((spot.pollutionScore ?? 0) * 100, 100)}%`, backgroundColor: INTENSITY_HEX[spot.intensity] }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{((spot.pollutionScore ?? 0) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{spot.modelsPresent || "Reference"}</span>
                          <span>{spot.trend || "Stable"}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Zone Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <StatRow label="Total Zones" value={hotspots.length} />
                <StatRow label="Critical" value={stats.Critical} className="text-red-600" />
                <StatRow label="High Risk" value={stats.High} className="text-orange-500" />
                <StatRow label="Moderate" value={stats.Moderate} className="text-amber-600" />
                <StatRow label="Low Risk" value={stats.Low} className="text-emerald-600" />
                <StatRow label="Rising Trend" value={stats.rising} />
                {!usingFallback && <StatRow label="Saved Data Points" value={stats.samples} />}
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground">Avg Pollution Score</span>
                  <span className="font-semibold">{(stats.avgScore * 100).toFixed(1)}%</span>
                </div>
                <StatRow label="Data Source" value={usingFallback ? "Reference" : mode === "predicted" ? "Latest LSTM + GRU forecast" : "Saved prediction history"} />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
