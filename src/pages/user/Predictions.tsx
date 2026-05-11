import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Brain, Play, Download,
  Database, CheckCircle, XCircle, Loader2, RefreshCw,
  Activity, AlertTriangle, Wifi, WifiOff, MapPin,
  BarChart3, Clock, Zap, Save, FileText, CloudUpload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ENV from "@/config/env";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const API = ENV.API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface RegionStatus {
  region: string;
  dataset_cached: boolean;
  model_trained: boolean;
  dataset_info?: { total_records: number; date_range: { start: string; end: string } };
  fetch_status?: { can_fetch: boolean; seconds_remaining: number; last_fetched_at: string | null };
}

interface Prediction {
  date: string;
  pollution_level: number;
  confidence: number;
}

interface ApiHealth {
  open_meteo: { status: string; key_required: boolean };
  waqi:       { status: string; key_required: boolean; sample_aqi?: number };
  noaa:       { status: string; key_required: boolean; datasets_available?: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const REGIONS = [
  { id: 'pacific',       name: 'Pacific Ocean',     desc: 'Great Pacific Garbage Patch region',    coords: '35°N 140°W' },
  { id: 'atlantic',      name: 'Atlantic Ocean',    desc: 'North Atlantic Gyre region',            coords: '40°N 40°W'  },
  { id: 'indian',        name: 'Indian Ocean',      desc: 'Indian Ocean Gyre region',              coords: '20°S 75°E'  },
  { id: 'mediterranean', name: 'Mediterranean Sea', desc: 'Enclosed sea — high retention',         coords: '36°N 18°E'  },
];

const RISK_COLOR: Record<string, string> = {
  Low: 'text-green-500', Moderate: 'text-yellow-500',
  High: 'text-orange-500', Critical: 'text-red-500',
};

const CHART_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
};

function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PredictionsPage() {
  const { toast } = useToast();
  const { token } = useAuth();

  const [selectedRegion, setSelectedRegion] = useState('pacific');
  const [epochs,         setEpochs]         = useState([50]);
  const [daysAhead,      setDaysAhead]       = useState('7');

  const [statuses,    setStatuses]    = useState<Record<string, RegionStatus>>({});
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [predSummary, setPredSummary] = useState<any>(null);
  const [apiHealth,   setApiHealth]   = useState<ApiHealth | null>(null);

  const [fetching,    setFetching]    = useState(false);
  const [training,    setTraining]    = useState(false);
  const [predicting,  setPredicting]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [savedCount,  setSavedCount]  = useState<number | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Countdown timer
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const authH = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Load all region statuses ──────────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    try {
      const [regionsRes, fetchStatusRes] = await Promise.all([
        fetch(`${API}/api/data/regions`),
        fetch(`${API}/api/data/fetch-status`),
      ]);
      const regData    = await regionsRes.json();
      const fetchData  = await fetchStatusRes.json();

      const map: Record<string, RegionStatus> = {};
      for (const r of (regData.regions || [])) {
        const trainRes = await fetch(`${API}/api/train/status/${r.id}`);
        const trainData = trainRes.ok ? await trainRes.json() : {};
        map[r.id] = {
          region:        r.id,
          dataset_cached: r.dataset_cached,
          model_trained:  trainData.ready_for_prediction ?? false,
          dataset_info:   r.dataset_info,
          fetch_status:   fetchData.regions?.[r.id],
        };
      }
      setStatuses(map);
    } catch (e) {
      console.error('loadStatuses:', e);
    }
  }, []);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  // ── API health check ──────────────────────────────────────────────────────
  const checkApiHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch(`${API}/api/data/api-health`);
      if (res.ok) {
        const data = await res.json();
        setApiHealth(data.apis);
      }
    } catch (e) {
      toast({ title: 'Health check failed', variant: 'destructive' });
    } finally { setLoadingHealth(false); }
  };

  // ── Step 1: Fetch data ────────────────────────────────────────────────────
  const handleFetch = async () => {
    setFetching(true);
    try {
      const res  = await fetch(`${API}/api/data/fetch`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ region: selectedRegion }),
      });
      const data = await res.json();

      if (data.message === 'cooldown_active') {
        setCountdown(data.seconds_remaining);
        toast({
          title: 'Cooldown active',
          description: `Next fetch in ${formatCountdown(data.seconds_remaining)}`,
          variant: 'destructive',
        });
        return;
      }

      if (data.success) {
        const info = data.dataset_info;
        toast({
          title: '✅ Data fetched',
          description: `${info?.total_records ?? '?'} records cached for ${selectedRegion}`,
        });
        await loadStatuses();
      } else {
        throw new Error(data.message || 'Fetch failed');
      }
    } catch (e: any) {
      toast({ title: 'Fetch failed', description: e.message, variant: 'destructive' });
    } finally { setFetching(false); }
  };

  // ── Step 2: Train model ───────────────────────────────────────────────────
  const handleTrain = async () => {
    setTraining(true);
    try {
      const res  = await fetch(`${API}/api/train`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ region: selectedRegion, epochs: epochs[0] }),
      });
      const data = await res.json();

      if (data.success) {
        const r = data.training_result;
        toast({
          title: '🧠 Training complete',
          description: `MAE: ${r.validation_mae?.toFixed(3) ?? '?'} | ${r.epochs_trained} epochs | ${r.training_samples} samples`,
        });
        await loadStatuses();
      } else {
        throw new Error(data.detail || 'Training failed');
      }
    } catch (e: any) {
      toast({ title: 'Training failed', description: e.message, variant: 'destructive' });
    } finally { setTraining(false); }
  };

  // ── Step 3: Predict ───────────────────────────────────────────────────────
  const handlePredict = async () => {
    setPredicting(true);
    setPredictions(null);
    setSavedCount(null);
    try {
      const res  = await fetch(`${API}/api/predict`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ region: selectedRegion, days_ahead: parseInt(daysAhead) }),
      });
      const data = await res.json();

      if (data.success) {
        setPredictions(data.predictions);
        setPredSummary(data.summary);
        const saved = data.saved_to_db ?? 0;
        setSavedCount(saved);
        toast({
          title: '🔮 Predictions ready',
          description: `${data.predictions.length}-day forecast generated · ${saved} rows saved to DB (heatmap & reports updated)`,
        });
      } else {
        throw new Error(data.detail || 'Prediction failed');
      }
    } catch (e: any) {
      toast({ title: 'Prediction failed', description: e.message, variant: 'destructive' });
    } finally { setPredicting(false); }
  };

  // ── Save result explicitly ────────────────────────────────────────────────
  const handleSaveResult = async () => {
    if (!predictions || predictions.length === 0) return;
    setSaving(true);
    try {
      // Re-run predict which saves to DB — or call a dedicated save endpoint
      const res  = await fetch(`${API}/api/predict`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ region: selectedRegion, days_ahead: parseInt(daysAhead) }),
      });
      const data = await res.json();
      if (data.success) {
        const saved = data.saved_to_db ?? 0;
        setSavedCount(saved);
        toast({
          title: '✅ Result Saved',
          description: `${saved} predictions saved — heatmap & reports are now updated`,
        });
      } else {
        throw new Error(data.detail || 'Save failed');
      }
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ── Download CSV ──────────────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    if (!predictions || predictions.length === 0) return;
    const regionName = REGIONS.find(r => r.id === selectedRegion)?.name ?? selectedRegion;
    const header = 'Date,Pollution Level,Confidence (%),Risk Level';
    const rows = predictions.map(p => {
      const risk = p.pollution_level >= 80 ? 'Critical'
                 : p.pollution_level >= 60 ? 'High'
                 : p.pollution_level >= 30 ? 'Moderate' : 'Low';
      return `${p.date},${p.pollution_level.toFixed(2)},${(p.confidence * 100).toFixed(1)},${risk}`;
    });
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${selectedRegion}_forecast_${daysAhead}d_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '📥 CSV Downloaded', description: `${predictions.length} rows exported` });
  };

  // ── Save as Report ────────────────────────────────────────────────────────
  const handleSaveAsReport = async () => {
    if (!predictions || predictions.length === 0) return;
    setSaving(true);
    try {
      const regionName = REGIONS.find(r => r.id === selectedRegion)?.name ?? selectedRegion;
      const res = await fetch(`${API}/api/reports/generate`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({
          report_type:     'prediction',
          title:           `${regionName} — ${daysAhead}-Day Forecast (${new Date().toLocaleDateString()})`,
          date_range_days: 30,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: '📄 Report Created',
          description: `"${data.report.title}" saved — view it in Reports`,
        });
      } else {
        throw new Error(data.detail || data.message || 'Report creation failed');
      }
    } catch (e: any) {
      toast({ title: 'Report failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const current = statuses[selectedRegion];
  const canFetch = current?.fetch_status?.can_fetch !== false;
  const hasCooldown = !canFetch && (current?.fetch_status?.seconds_remaining ?? 0) > 0;

  const chartData = predictions?.map(p => ({
    date:      p.date.slice(5),   // MM-DD
    level:     Math.round(p.pollution_level * 10) / 10,
    conf_high: Math.round((p.pollution_level + (1 - p.confidence) * 15) * 10) / 10,
    conf_low:  Math.round((p.pollution_level - (1 - p.confidence) * 15) * 10) / 10,
  })) ?? [];

  const riskLevel = predSummary?.risk_level ?? 'Unknown';

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="section-header mb-1">Marine Pollution Forecasting</h1>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                LSTM neural network predictions using real environmental data
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={checkApiHealth} disabled={loadingHealth} className="gap-1.5 text-[12.5px] font-semibold self-start sm:self-auto">
              {loadingHealth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              Check APIs
            </Button>
          </div>

          {/* API Health */}
          {apiHealth && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12.5px] sm:text-[13.5px] font-display font-bold tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Data Source Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Object.entries(apiHealth).map(([name, info]) => (
                    <div key={name} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-xl">
                      <div>
                        <p className="text-[12.5px] font-bold capitalize">{name.replace('_', '-')}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {info.key_required ? 'API key' : 'Free / no key'}
                          {name === 'waqi' && info.sample_aqi ? ` · AQI ${info.sample_aqi}` : ''}
                          {name === 'noaa' && info.datasets_available ? ` · ${info.datasets_available} datasets` : ''}
                        </p>
                      </div>
                      {info.status === 'ok'
                        ? <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                        : <XCircle    className="h-4 w-4 text-destructive flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Region Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {REGIONS.map(r => {
              const s = statuses[r.id];
              const active = r.id === selectedRegion;
              return (
                <Card
                  key={r.id}
                  className={`glass-card cursor-pointer transition-all hover-lift ${active ? 'ring-2 ring-primary shadow-glow' : ''}`}
                  onClick={() => { setSelectedRegion(r.id); setPredictions(null); }}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-2">
                      <MapPin className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex gap-1">
                        {s?.dataset_cached && <div className="w-2 h-2 rounded-full bg-success" title="Data cached" />}
                        {s?.model_trained  && <div className="w-2 h-2 rounded-full bg-primary"  title="Model trained" />}
                      </div>
                    </div>
                    <p className={`text-[12.5px] sm:text-[13.5px] font-bold leading-tight tracking-tight ${active ? 'text-primary' : ''}`}>{r.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{r.coords}</p>
                    {s?.dataset_info && (
                      <p className="text-[11px] text-muted-foreground mt-1 font-semibold">{s.dataset_info.total_records} rows</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pipeline — 3 steps */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-[13.5px] sm:text-[15px] font-bold tracking-tight flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Prediction Pipeline — {REGIONS.find(r => r.id === selectedRegion)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">

                {/* Step 1 */}
                <div className="p-3.5 sm:p-4 border border-border/60 rounded-2xl space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${current?.dataset_cached ? 'bg-success' : 'bg-primary'}`}>
                      {current?.dataset_cached ? '✓' : '1'}
                    </div>
                    <div>
                      <p className="text-[13px] sm:text-[13.5px] font-bold tracking-tight">Fetch Data</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Real + synthetic</p>
                    </div>
                  </div>
                  {current?.dataset_info && (
                    <div className="text-[11px] text-muted-foreground space-y-0.5 font-medium">
                      <p>{current.dataset_info.total_records} records</p>
                      <p>{current.dataset_info.date_range.start} → {current.dataset_info.date_range.end}</p>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full text-[12px] gap-1.5 font-bold"
                    onClick={handleFetch}
                    disabled={fetching || hasCooldown}
                    variant={current?.dataset_cached ? 'outline' : 'default'}
                  >
                    {fetching
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Fetching…</>
                      : hasCooldown
                        ? <><Clock className="h-3.5 w-3.5" />{formatCountdown(countdown || current?.fetch_status?.seconds_remaining || 0)}</>
                        : <><Download className="h-3.5 w-3.5" />{current?.dataset_cached ? 'Re-fetch' : 'Fetch Data'}</>}
                  </Button>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 sm:p-4 border border-border/60 rounded-2xl space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${current?.model_trained ? 'bg-success' : 'bg-primary'}`}>
                      {current?.model_trained ? '✓' : '2'}
                    </div>
                    <div>
                      <p className="text-[13px] sm:text-[13.5px] font-bold tracking-tight">Train Model</p>
                      <p className="text-[11px] text-muted-foreground font-medium">LSTM neural network</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-semibold">Epochs: {epochs[0]}</p>
                    <Slider
                      value={epochs}
                      onValueChange={setEpochs}
                      min={10} max={100} step={10}
                      disabled={training}
                      className="w-full"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full text-[12px] gap-1.5 font-bold"
                    onClick={handleTrain}
                    disabled={training || !current?.dataset_cached}
                    variant={current?.model_trained ? 'outline' : 'default'}
                  >
                    {training
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Training…</>
                      : <><Brain className="h-3.5 w-3.5" />{current?.model_trained ? 'Retrain' : 'Train Model'}</>}
                  </Button>
                  {!current?.dataset_cached && (
                    <p className="text-[11px] text-muted-foreground text-center font-medium">Fetch data first</p>
                  )}
                </div>

                {/* Step 3 */}
                <div className="p-3.5 sm:p-4 border border-border/60 rounded-2xl space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${predictions ? 'bg-success' : 'bg-primary'}`}>
                      {predictions ? '✓' : '3'}
                    </div>
                    <div>
                      <p className="text-[13px] sm:text-[13.5px] font-bold tracking-tight">Generate Forecast</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Pollution predictions</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-semibold">Forecast horizon</p>
                    <Select value={daysAhead} onValueChange={setDaysAhead}>
                      <SelectTrigger className="h-8 text-[12px] font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['7','14','30','60','90'].map(d => (
                          <SelectItem key={d} value={d}>{d} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="w-full text-[12px] gap-1.5 font-bold"
                    onClick={handlePredict}
                    disabled={predicting || !current?.model_trained}
                  >
                    {predicting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Predicting…</>
                      : <><Play className="h-3.5 w-3.5" />Predict {daysAhead} Days</>}
                  </Button>
                  {!current?.model_trained && (
                    <p className="text-[11px] text-muted-foreground text-center font-medium">Train model first</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prediction Results */}
          {predictions && predictions.length > 0 && (
            <>
              {/* Summary cards */}
              {predSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  {[
                    { label: 'Current Level',  value: `${predSummary.current_level?.toFixed(1) ?? '—'}`,   unit: '/100' },
                    { label: 'Predicted Level', value: `${predSummary.predicted_level?.toFixed(1) ?? '—'}`, unit: '/100' },
                    { label: 'Trend Change',   value: `${predSummary.trend_change_percent?.toFixed(1) ?? '—'}`, unit: '%' },
                    { label: 'Risk Level',     value: riskLevel, unit: '', color: RISK_COLOR[riskLevel] },
                  ].map(({ label, value, unit, color }) => (
                    <Card key={label} className="glass-card hover-lift">
                      <CardContent className="p-3 sm:p-4">
                        <p className="text-[11px] text-muted-foreground mb-1.5 font-bold uppercase tracking-wider">{label}</p>
                        <p className={`font-display text-xl sm:text-2xl font-bold tracking-tight ${color ?? ''}`}>
                          {value}<span className="text-[11px] font-semibold text-muted-foreground ml-0.5">{unit}</span>
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Chart */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {daysAhead}-Day Pollution Forecast — {REGIONS.find(r => r.id === selectedRegion)?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pollGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="hsl(203,77%,40%)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="hsl(203,77%,40%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="hsl(170,50%,45%)" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="hsl(170,50%,45%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={CHART_STYLE} />
                        <ReferenceLine y={60} stroke="hsl(38,92%,50%)" strokeDasharray="4 2" label={{ value: 'High', fontSize: 10 }} />
                        <ReferenceLine y={80} stroke="hsl(0,72%,51%)"  strokeDasharray="4 2" label={{ value: 'Critical', fontSize: 10 }} />
                        <Area type="monotone" dataKey="conf_high" stroke="none" fill="url(#confGrad)" />
                        <Area type="monotone" dataKey="conf_low"  stroke="none" fill="white" fillOpacity={0.01} />
                        <Area type="monotone" dataKey="level" stroke="hsl(203,77%,40%)" strokeWidth={2} fill="url(#pollGrad)" dot={{ r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[hsl(203,77%,40%)] inline-block" />Pollution Level</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[hsl(38,92%,50%)] inline-block border-dashed border-t" />High threshold (60)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[hsl(0,72%,51%)] inline-block" />Critical threshold (80)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Action bar + Table */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-sm sm:text-base">Daily Forecast Table</CardTitle>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {/* Save Result */}
                      <Button
                        size="sm"
                        variant={savedCount !== null ? 'outline' : 'default'}
                        className="gap-1.5 text-xs"
                        onClick={handleSaveResult}
                        disabled={saving || predicting}
                      >
                        {saving
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
                          : savedCount !== null
                            ? <><CheckCircle className="h-3.5 w-3.5 text-green-500" />{savedCount} Saved</>
                            : <><CloudUpload className="h-3.5 w-3.5" />Save Result</>}
                      </Button>

                      {/* Download CSV */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={handleDownloadCSV}
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </Button>

                      {/* Save as Report */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={handleSaveAsReport}
                        disabled={saving}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Save as Report
                      </Button>
                    </div>
                  </div>

                  {/* Save status indicator */}
                  {savedCount !== null && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {savedCount} predictions saved to database — heatmap &amp; reports are up to date
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Date</th>
                          <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Pollution</th>
                          <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Confidence</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictions.map((p, i) => {
                          const risk = p.pollution_level >= 80 ? 'Critical'
                                     : p.pollution_level >= 60 ? 'High'
                                     : p.pollution_level >= 30 ? 'Moderate' : 'Low';
                          return (
                            <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                              <td className="py-2 pr-4">{p.date}</td>
                              <td className="py-2 pr-4 text-right font-medium">{p.pollution_level.toFixed(1)}</td>
                              <td className="py-2 pr-4 text-right text-muted-foreground">{(p.confidence * 100).toFixed(0)}%</td>
                              <td className="py-2 text-right">
                                <Badge variant="outline" className={`text-xs ${RISK_COLOR[risk]}`}>{risk}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Empty state */}
          {!predictions && (
            <Card className="glass-card">
              <CardContent className="py-10 sm:py-14 text-center">
                <Brain className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-sm sm:text-base mb-1">No Predictions Yet</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                  Select a region, fetch its data, train the LSTM model, then generate a forecast.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </PageTransition>
    </MainLayout>
  );
}
