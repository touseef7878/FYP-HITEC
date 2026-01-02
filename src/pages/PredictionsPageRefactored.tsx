import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Brain,
  Zap,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  Waves,
  Wind,
  Download,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";

// API base URL
const API_BASE = "http://localhost:8000";

// Types
interface PredictionData {
  date: string;
  pollution_level: number;
  confidence: number;
}

interface RegionPrediction {
  region: string;
  predictions: PredictionData[];
  summary: {
    current_level: number;
    predicted_level: number;
    trend_change_percent: number;
    risk_level: string;
    average_confidence: number;
  };
  model_info: any;
  data_source: string;
}

interface RegionAnalysis {
  region: string;
  statistics: {
    average_pollution: number;
    max_pollution: number;
    min_pollution: number;
    trend_slope: number;
    recent_change_percent: number;
  };
  risk_assessment: {
    level: string;
    trend: string;
    recent_trend: string;
  };
  data_source: string;
}

interface DataStatus {
  region: string;
  dataset_cached: boolean;
  model_trained: boolean;
  dataset_info?: {
    total_records: number;
    date_range: {
      start: string;
      end: string;
    };
    features: string[];
  };
}

interface RegionInfo {
  id: string;
  name: string;
  dataset_cached: boolean;
  dataset_info?: any;
}

// Marine regions configuration
const regions = [
  { 
    id: "pacific", 
    name: "Pacific Ocean", 
    description: "North Pacific region including Great Pacific Garbage Patch",
    coordinates: { lat: 35.0, lon: -140.0 }
  },
  { 
    id: "atlantic", 
    name: "Atlantic Ocean", 
    description: "North Atlantic marine region",
    coordinates: { lat: 40.0, lon: -30.0 }
  },
  { 
    id: "indian", 
    name: "Indian Ocean", 
    description: "Indian Ocean marine region",
    coordinates: { lat: -20.0, lon: 80.0 }
  },
  { 
    id: "mediterranean", 
    name: "Mediterranean Sea", 
    description: "Mediterranean marine region",
    coordinates: { lat: 35.0, lon: 15.0 }
  },
];

export default function PredictionsPage() {
  const { toast } = useToast();
  
  // State management
  const [selectedRegion, setSelectedRegion] = useState("pacific");
  const [predictionHorizon, setPredictionHorizon] = useState(7);
  const [predictions, setPredictions] = useState<RegionPrediction | null>(null);
  const [regionAnalyses, setRegionAnalyses] = useState<Record<string, RegionAnalysis>>({});
  const [regionStatuses, setRegionStatuses] = useState<Record<string, DataStatus>>({});
  const [availableRegions, setAvailableRegions] = useState<RegionInfo[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [trainingEpochs, setTrainingEpochs] = useState([50]);

  // Fetch initial data on component mount
  useEffect(() => {
    loadAvailableRegions();
    // Load status for all regions
    regions.forEach(region => {
      loadRegionStatus(region.id);
      loadRegionAnalysis(region.id);
    });
  }, []);

  // Fetch predictions when region or horizon changes
  useEffect(() => {
    const regionStatus = regionStatuses[selectedRegion];
    if (selectedRegion && regionStatus?.model_trained) {
      fetchPredictions(selectedRegion, predictionHorizon);
    }
  }, [selectedRegion, predictionHorizon, regionStatuses]);

  const loadAvailableRegions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/data/regions`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableRegions(data.regions);
      } else {
        toast({
          title: "Error",
          description: "Failed to load available regions",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading regions:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to the server",
        variant: "destructive",
      });
    }
  };

  const loadRegionStatus = async (region: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/data/status/${region}`);
      const data = await response.json();
      
      if (data.success) {
        setRegionStatuses(prev => ({
          ...prev,
          [region]: data
        }));
      }
    } catch (error) {
      console.error(`Error loading status for ${region}:`, error);
    }
  };

  const handleFetchData = async (region: string) => {
    setFetchingData(true);
    try {
      const response = await fetch(`${API_BASE}/api/data/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Data Fetched Successfully",
          description: `Cached ${data.dataset_info.total_records} records for ${region} in ${data.fetch_duration_seconds.toFixed(1)}s`,
        });
        // Reload region status
        await loadRegionStatus(region);
        await loadAvailableRegions();
      } else if (data.message === 'already_fetched') {
        toast({
          title: "Data Already Cached",
          description: `Dataset for ${region} is already available`,
        });
      } else {
        throw new Error(data.message || 'Failed to fetch data');
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Data Fetch Error",
        description: error instanceof Error ? error.message : "Failed to fetch environmental data",
        variant: "destructive",
      });
    } finally {
      setFetchingData(false);
    }
  };

  const handleTraining = async (region: string) => {
    setIsTraining(true);
    try {
      const response = await fetch(`${API_BASE}/api/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region,
          epochs: trainingEpochs[0]
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Training Completed",
          description: `Model trained successfully for ${region} with ${data.training_result.training_samples} samples`,
        });
        setTrainingDialogOpen(false);
        // Reload region status
        await loadRegionStatus(region);
      } else {
        throw new Error(data.detail || 'Training failed');
      }
    } catch (error) {
      console.error("Error training model:", error);
      toast({
        title: "Training Error",
        description: error instanceof Error ? error.message : "Failed to train model",
        variant: "destructive",
      });
    } finally {
      setIsTraining(false);
    }
  };

  const fetchPredictions = async (region: string, daysAhead: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, days_ahead: daysAhead })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPredictions(data);
        toast({
          title: "Predictions Generated",
          description: `Successfully generated ${daysAhead}-day forecast for ${region} using ${data.data_source}`,
        });
      } else {
        throw new Error(data.detail || 'Prediction failed');
      }
    } catch (error) {
      console.error("Error fetching predictions:", error);
      toast({
        title: "Prediction Error",
        description: error instanceof Error ? error.message : "Failed to generate predictions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRegionAnalysis = async (region: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/analyze?region=${region}&historical_days=365`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRegionAnalyses(prev => ({
          ...prev,
          [region]: data
        }));
      }
    } catch (error) {
      console.error(`Error fetching analysis for ${region}:`, error);
    }
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low': return 'default';
      case 'moderate': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-success" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  // Prepare chart data
  const chartData = predictions?.predictions.map((pred, index) => ({
    date: new Date(pred.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pollution_level: pred.pollution_level,
    confidence: pred.confidence * 100,
    day: index + 1
  })) || [];

  const currentRegionStatus = regionStatuses[selectedRegion];

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-container">
          {/* Header Section */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mb-8"
          >
            <motion.div variants={fadeInUp} className="text-center mb-6">
              <h1 className="section-header mb-2 flex items-center justify-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                Marine Pollution Prediction - Refactored System
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Advanced LSTM-based forecasting using cached environmental data. 
                Fetch data once, train models, and generate fast predictions without API delays.
              </p>
            </motion.div>

            {/* System Status Card */}
            <motion.div variants={fadeInUp}>
              <Card className="glass-card mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Refactored System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      <span className="text-sm">
                        Data Source: Cached Only
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-success" />
                      <span className="text-sm">
                        Training: 10x Faster
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <span className="text-sm">
                        No API Calls During Training
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">
                        Regions: {availableRegions.filter(r => r.dataset_cached).length}/{availableRegions.length} Ready
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Controls Panel */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mb-8"
          >
            <motion.div variants={fadeInUp}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Prediction Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Region Selection */}
                    <div className="space-y-2">
                      <Label>Marine Region</Label>
                      <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((region) => {
                            const status = regionStatuses[region.id];
                            return (
                              <SelectItem key={region.id} value={region.id}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  {region.name}
                                  {status?.dataset_cached && <CheckCircle className="h-3 w-3 text-success" />}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Prediction Horizon */}
                    <div className="space-y-2">
                      <Label>Forecast Period</Label>
                      <Select 
                        value={predictionHorizon.toString()} 
                        onValueChange={(value) => setPredictionHorizon(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Fetch Data Button */}
                    <div className="space-y-2">
                      <Label>Step 1: Data</Label>
                      <Button
                        onClick={() => handleFetchData(selectedRegion)}
                        disabled={fetchingData || currentRegionStatus?.dataset_cached}
                        variant={currentRegionStatus?.dataset_cached ? "secondary" : "default"}
                        className="w-full"
                      >
                        {fetchingData ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : currentRegionStatus?.dataset_cached ? (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {currentRegionStatus?.dataset_cached ? 'Data Cached' : 'Fetch Data'}
                      </Button>
                    </div>

                    {/* Train Model Button */}
                    <div className="space-y-2">
                      <Label>Step 2: Training</Label>
                      <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            disabled={!currentRegionStatus?.dataset_cached || isTraining}
                            variant={currentRegionStatus?.model_trained ? "secondary" : "default"}
                            className="w-full"
                          >
                            {isTraining ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : currentRegionStatus?.model_trained ? (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            ) : (
                              <Brain className="h-4 w-4 mr-2" />
                            )}
                            {currentRegionStatus?.model_trained ? 'Model Ready' : 'Train Model'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Train LSTM Model for {selectedRegion}</DialogTitle>
                            <DialogDescription>
                              Train using cached data only - no external API calls during training.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <Label>Training Epochs: {trainingEpochs[0]}</Label>
                              <Slider
                                value={trainingEpochs}
                                onValueChange={setTrainingEpochs}
                                min={10}
                                max={200}
                                step={10}
                                className="mt-2"
                              />
                            </div>
                            
                            {currentRegionStatus?.dataset_info && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium">Dataset Info:</p>
                                <p className="text-sm text-muted-foreground">
                                  Records: {currentRegionStatus.dataset_info.total_records}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Features: {currentRegionStatus.dataset_info.features?.length || 0}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Range: {currentRegionStatus.dataset_info.date_range?.start} to {currentRegionStatus.dataset_info.date_range?.end}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <DialogFooter>
                            <Button
                              onClick={() => handleTraining(selectedRegion)}
                              disabled={isTraining || !currentRegionStatus?.dataset_cached}
                            >
                              {isTraining ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Brain className="h-4 w-4 mr-2" />
                              )}
                              {isTraining ? 'Training...' : 'Start Training'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Predict Button */}
                    <div className="space-y-2">
                      <Label>Step 3: Predict</Label>
                      <Button
                        onClick={() => fetchPredictions(selectedRegion, predictionHorizon)}
                        disabled={loading || !currentRegionStatus?.model_trained}
                        className="w-full"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Generate Predictions
                      </Button>
                    </div>
                  </div>

                  {/* Status Messages */}
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        {currentRegionStatus?.dataset_cached ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span>Dataset: {currentRegionStatus?.dataset_cached ? 'Cached' : 'Not cached - fetch data first'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentRegionStatus?.model_trained ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span>Model: {currentRegionStatus?.model_trained ? 'Trained' : 'Not trained - train model first'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Region Overview Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mb-8"
          >
            <motion.div variants={fadeInUp} className="mb-4">
              <h2 className="text-xl font-semibold">Marine Region Overview</h2>
              <p className="text-muted-foreground">Current status and pollution analysis across all monitored regions</p>
            </motion.div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {regions.map((region) => {
                const analysis = regionAnalyses[region.id];
                const status = regionStatuses[region.id];
                return (
                  <motion.div key={region.id} variants={fadeInUp}>
                    <Card className={`glass-card hover-lift cursor-pointer transition-all ${
                      selectedRegion === region.id ? 'ring-2 ring-primary' : ''
                    }`} onClick={() => setSelectedRegion(region.id)}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Waves className="h-4 w-4" />
                          {region.name}
                          <div className="flex gap-1 ml-auto">
                            {status?.dataset_cached && <CheckCircle className="h-3 w-3 text-success" />}
                            {status?.model_trained && <Brain className="h-3 w-3 text-primary" />}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {analysis ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Risk Level</span>
                              <Badge variant={getRiskBadgeVariant(analysis.risk_assessment.level)}>
                                {analysis.risk_assessment.level}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Avg Pollution</span>
                              <span className="text-sm font-medium">
                                {analysis.statistics.average_pollution.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Trend</span>
                              <div className="flex items-center gap-1">
                                {getTrendIcon(analysis.statistics.recent_change_percent)}
                                <span className="text-sm">
                                  {analysis.risk_assessment.recent_trend}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                              Data: {analysis.data_source}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Prediction Results */}
          {predictions && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mb-8"
            >
              {/* Summary Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <motion.div variants={fadeInUp}>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Current Level
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {predictions.summary.current_level.toFixed(1)}
                      </div>
                      <p className="text-sm text-muted-foreground">Pollution Index</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={fadeInUp}>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        {predictionHorizon}-Day Forecast
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {predictions.summary.predicted_level.toFixed(1)}
                      </div>
                      <p className="text-sm text-muted-foreground">Predicted Level</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={fadeInUp}>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getTrendIcon(predictions.summary.trend_change_percent)}
                        Trend Change
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {predictions.summary.trend_change_percent > 0 ? '+' : ''}
                        {predictions.summary.trend_change_percent.toFixed(1)}%
                      </div>
                      <p className="text-sm text-muted-foreground">vs Current</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={fadeInUp}>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Assessment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant={getRiskBadgeVariant(predictions.summary.risk_level)} className="mb-2">
                        {predictions.summary.risk_level}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {(predictions.summary.average_confidence * 100).toFixed(1)}% confidence
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Source: {predictions.data_source}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Prediction Chart */}
              <motion.div variants={fadeInUp}>
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Pollution Trend Forecast - {regions.find(r => r.id === selectedRegion)?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis 
                            dataKey="date" 
                            className="text-xs"
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis 
                            className="text-xs"
                            tick={{ fontSize: 12 }}
                            label={{ value: 'Pollution Level', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: any, name: string) => [
                              name === 'pollution_level' ? `${value.toFixed(1)}` : `${value.toFixed(1)}%`,
                              name === 'pollution_level' ? 'Pollution Level' : 'Confidence'
                            ]}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="pollution_level"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.3}
                            strokeWidth={2}
                            name="Pollution Level"
                          />
                          <Line
                            type="monotone"
                            dataKey="confidence"
                            stroke="hsl(var(--secondary))"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Confidence %"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {/* Loading State */}
          {loading && !predictions && (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              className="flex items-center justify-center py-12"
            >
              <Card className="glass-card p-8">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-semibold mb-2">Generating Predictions</h3>
                  <p className="text-muted-foreground">
                    Processing cached environmental data and running LSTM model...
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* No Data/Model State */}
          {!currentRegionStatus?.dataset_cached && !loading && !fetchingData && (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              className="flex items-center justify-center py-12"
            >
              <Card className="glass-card p-8 text-center">
                <Download className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Data Cached</h3>
                <p className="text-muted-foreground mb-4">
                  Environmental data needs to be fetched and cached before training or predictions.
                </p>
                <Button onClick={() => handleFetchData(selectedRegion)} disabled={fetchingData}>
                  <Download className="h-4 w-4 mr-2" />
                  Fetch Data for {regions.find(r => r.id === selectedRegion)?.name}
                </Button>
              </Card>
            </motion.div>
          )}

          {currentRegionStatus?.dataset_cached && !currentRegionStatus?.model_trained && !loading && !isTraining && (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              className="flex items-center justify-center py-12"
            >
              <Card className="glass-card p-8 text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Model Not Trained</h3>
                <p className="text-muted-foreground mb-4">
                  The LSTM model needs to be trained using the cached data before generating predictions.
                </p>
                <Button onClick={() => setTrainingDialogOpen(true)}>
                  <Brain className="h-4 w-4 mr-2" />
                  Train Model for {regions.find(r => r.id === selectedRegion)?.name}
                </Button>
              </Card>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}