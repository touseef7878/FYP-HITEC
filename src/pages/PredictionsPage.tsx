import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Sample LSTM prediction data
const predictionData = [
  { month: "Jan", actual: 45, predicted: 47 },
  { month: "Feb", actual: 52, predicted: 50 },
  { month: "Mar", actual: 49, predicted: 51 },
  { month: "Apr", actual: 58, predicted: 56 },
  { month: "May", actual: 63, predicted: 62 },
  { month: "Jun", actual: 71, predicted: 69 },
  { month: "Jul", actual: null, predicted: 75 },
  { month: "Aug", actual: null, predicted: 78 },
  { month: "Sep", actual: null, predicted: 82 },
  { month: "Oct", actual: null, predicted: 79 },
  { month: "Nov", actual: null, predicted: 74 },
  { month: "Dec", actual: null, predicted: 70 },
];

const areas = [
  { id: "pacific", name: "Pacific Ocean", trend: "+12.5%", status: "increasing" },
  { id: "atlantic", name: "Atlantic Ocean", trend: "+8.2%", status: "increasing" },
  { id: "indian", name: "Indian Ocean", trend: "+15.3%", status: "increasing" },
  { id: "mediterranean", name: "Mediterranean Sea", trend: "-2.1%", status: "decreasing" },
];

const forecasts = [
  {
    area: "Great Pacific Garbage Patch",
    prediction: "18% increase by Q4 2024",
    risk: "high",
    details: "Expected growth due to seasonal current patterns",
  },
  {
    area: "Southeast Asian Waters",
    prediction: "12% increase by Q4 2024",
    risk: "medium",
    details: "Monsoon season may increase debris accumulation",
  },
  {
    area: "Mediterranean Zone",
    prediction: "5% decrease by Q4 2024",
    risk: "low",
    details: "Cleanup initiatives showing positive results",
  },
];

export default function PredictionsPage() {
  const [selectedArea, setSelectedArea] = useState("pacific");

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-8">
          <h1 className="section-header">Area-Wise Trend Predictions</h1>
          <p className="text-muted-foreground">
            LSTM-powered pollution forecasting and hotspot accumulation analysis
          </p>
        </div>

        {/* Area Selector */}
        <Card className="glass-card mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="font-medium">Select Region:</span>
              </div>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Forecast: 6 months ahead
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Area Stats */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-4 gap-4 mb-6"
        >
          {areas.map((area, index) => (
            <motion.div key={area.id} variants={fadeInUp}>
              <Card
                className={`glass-card hover-lift cursor-pointer transition-all ${
                  selectedArea === area.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedArea(area.id)}
              >
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground mb-1">{area.name}</p>
                  <div className="flex items-center gap-2">
                    {area.status === "increasing" ? (
                      <TrendingUp className="h-5 w-5 text-destructive" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-success" />
                    )}
                    <span
                      className={`text-lg font-bold ${
                        area.status === "increasing"
                          ? "text-destructive"
                          : "text-success"
                      }`}
                    >
                      {area.trend}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Prediction Chart */}
          <div className="lg:col-span-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Pollution Trend Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={predictionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="hsl(203, 77%, 26%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(203, 77%, 26%)", strokeWidth: 2 }}
                        name="Actual Data"
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="hsl(170, 50%, 45%)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: "hsl(170, 50%, 45%)", strokeWidth: 2 }}
                        name="LSTM Prediction"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-primary" />
                    <span>Historical Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-secondary border-dashed" style={{ borderTop: "2px dashed hsl(170, 50%, 45%)" }} />
                    <span>LSTM Forecast</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hotspot Forecasts */}
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Hotspot Forecasts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {forecasts.map((forecast, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{forecast.area}</h4>
                      <Badge
                        variant={
                          forecast.risk === "high"
                            ? "destructive"
                            : forecast.risk === "medium"
                            ? "secondary"
                            : "default"
                        }
                        className="text-xs"
                      >
                        {forecast.risk} risk
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-primary mb-1">
                      {forecast.prediction}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {forecast.details}
                    </p>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Model Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model Type</span>
                  <span>LSTM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span>94.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Training Data</span>
                  <span>5 years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>Jan 15, 2024</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
