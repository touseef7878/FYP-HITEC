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

interface AreaPrediction {
  area: string;
  predictions: PredictionData[];
  summary: {
    current_level: number;
    predicted_level: number;
    trend_change_percent: number;
    risk_level: string;
    average_confidence: number;
  };
  model_info: any;
}

interface AreaAnalysis {
  area: string;
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
}

interface ModelInfo {
  status: string;
  model_exists: boolean;
  config: any;
  model_size_mb: number;
}

// Marine areas configuration
const areas = [
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
  const [selectedArea, setSelectedArea] = useState("pacific");
  const [predictionHorizon, setPredictionHorizon] = useState(7);
  const [predictions, setPredictions] = useState<AreaPrediction | null>(null);
  const [areaAnalyses, setAreaAnalyses] = useState<Record<string, AreaAnalysis>>({});
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [trainingEpochs, setTrainingEpochs] = useState([50]);
  const [selectedTrainingAreas, setSelectedTrainingAreas] = useState<string[]>(['pacific', 'atlantic', 'indian', 'mediterranean']);

  // Fetch model info on component mount
  useEffect(() => {
    fetchModelInfo();
    // Fetch analysis for all areas on page load
    areas.forEach(area => {
      fetchAreaAnalysis(area.id);
    });
  }, []);

  // Fetch predictions when area or horizon changes
  useEffect(() => {
    if (selectedArea && modelInfo?.status === 'loaded') {
      fetchPredictions(selectedArea, predictionHorizon);
    }
  }, [selectedArea, predictionHorizon, modelInfo]);

  const fetchModelInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/prediction/model-info`);
      const data = await response.json();
      
      if (data.success) {
        setModelInfo(data.model_info);
      } else {
        toast({
          title: "Model Info Error",
          description: "Failed to fetch model information",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching model info:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to prediction service",
        variant: "destructive",
      });
    }
  };

  const fetchPredictions = async (area: string, daysAhead: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/prediction/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, days_ahead: daysAhead })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPredictions(data);
        toast({
          title: "Predictions Generated",
          description: `Successfully generated ${daysAhead}-day forecast for ${area}`,
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

  const fetchAreaAnalysis = async (area: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/prediction/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, historical_days: 365 })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAreaAnalyses(prev => ({
          ...prev,
          [area]: data
        }));
      }
    } catch (error) {
      console.error(`Error fetching analysis for ${area}:`, error);
    }
  };

  const handleTraining = async () => {
    setIsTraining(true);
    try {
      const response = await fetch(`${API_BASE}/api/prediction/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epochs: trainingEpochs[0],
          areas: selectedTrainingAreas
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Training Completed",
          description: `Model trained successfully on ${data.total_samples} samples`,
        });
        setTrainingDialogOpen(false);
        fetchModelInfo(); // Refresh model info
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
                Environmental & Marine Trend Prediction
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Advanced LSTM-based forecasting system using real environmental data from multiple sources 
                including NOAA Climate Data, World Air Quality Index, and marine observations.
              </p>
            </motion.div>

            {/* Model Status Card */}
            <motion.div variants={fadeInUp}>
              <Card className="glass-card mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    LSTM Model Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      {modelInfo?.status === 'loaded' ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="text-sm">
                        Status: {modelInfo?.status === 'loaded' ? 'Ready' : 'Not Loaded'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">
                        Size: {modelInfo?.model_size_mb || 0} MB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">
                        Features: {modelInfo?.config?.n_features || 8}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">
                        Sequence: {modelInfo?.config?.sequence_length || 30} days
                      </span>
                    </div>
                  </div>
                  
                  {modelInfo?.config?.last_trained && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Last trained: {new Date(modelInfo.config.last_trained).toLocaleString()}
                      </p>
                      {modelInfo.config.validation_mae && (
                        <p className="text-sm text-muted-foreground">
                          Validation MAE: {modelInfo.config.validation_mae.toFixed(4)} | 
                          RMSE: {modelInfo.config.validation_rmse.toFixed(4)}
                        </p>
                      )}
                    </div>
                  )}
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
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Area Selection */}
                    <div className="space-y-2">
                      <Label>Marine Region</Label>
                      <Select value={selectedArea} onValueChange={setSelectedArea}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {areas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {area.name}
                              </div>
                            </SelectItem>
                          ))}
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

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <Label>Actions</Label>
                      <Button
                        onClick={() => fetchPredictions(selectedArea, predictionHorizon)}
                        disabled={loading || modelInfo?.status !== 'loaded'}
                        className="w-full"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Run Prediction
                      </Button>
                    </div>

                    {/* Training Button */}
                    <div className="space-y-2">
                      <Label>Model Training</Label>
                      <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full">
                            <Brain className="h-4 w-4 mr-2" />
                            Train Model
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Train LSTM Model</DialogTitle>
                            <DialogDescription>
                              Configure training parameters for the environmental prediction model.
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
                            
                            <div>
                              <Label>Training Areas</Label>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {areas.map((area) => (
                                  <div key={area.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={area.id}
                                      checked={selectedTrainingAreas.includes(area.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedTrainingAreas([...selectedTrainingAreas, area.id]);
                                        } else {
                                          setSelectedTrainingAreas(selectedTrainingAreas.filter(a => a !== area.id));
                                        }
                                      }}
                                    />
                                    <Label htmlFor={area.id} className="text-sm">
                                      {area.name}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <DialogFooter>
                            <Button
                              onClick={handleTraining}
                              disabled={isTraining || selectedTrainingAreas.length === 0}
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
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Area Overview Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mb-8"
          >
            <motion.div variants={fadeInUp} className="mb-4">
              <h2 className="text-xl font-semibold">Marine Area Overview</h2>
              <p className="text-muted-foreground">Current pollution status across all monitored regions</p>
            </motion.div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {areas.map((area) => {
                const analysis = areaAnalyses[area.id];
                return (
                  <motion.div key={area.id} variants={fadeInUp}>
                    <Card className={`glass-card hover-lift cursor-pointer transition-all ${
                      selectedArea === area.id ? 'ring-2 ring-primary' : ''
                    }`} onClick={() => setSelectedArea(area.id)}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Waves className="h-4 w-4" />
                          {area.name}
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
                      Pollution Trend Forecast - {areas.find(a => a.id === selectedArea)?.name}
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
                    Processing environmental data and running LSTM model...
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* No Model State */}
          {modelInfo?.status !== 'loaded' && !loading && (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              className="flex items-center justify-center py-12"
            >
              <Card className="glass-card p-8 text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Model Not Ready</h3>
                <p className="text-muted-foreground mb-4">
                  The LSTM model needs to be trained before generating predictions.
                </p>
                <Button onClick={() => setTrainingDialogOpen(true)}>
                  <Brain className="h-4 w-4 mr-2" />
                  Train Model
                </Button>
              </Card>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}