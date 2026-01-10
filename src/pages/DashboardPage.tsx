import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Package,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { dataService, AnalyticsData } from "@/lib/dataService";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

export default function DashboardPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connection Restored",
        description: "Refreshing analytics data...",
      });
      loadAnalyticsData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Connection Lost",
        description: "Using cached data. Some features may be limited.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  const loadAnalyticsData = async () => {
    try {
      // Always generate fresh analytics first
      await dataService.generateAnalytics();
      const data = await dataService.getAnalytics();
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      
      // Handle different error types
      if (error instanceof Error) {
        if (error.message === 'Authentication expired') {
          toast({
            title: "Session Expired",
            description: "Please log in again to continue",
            variant: "destructive",
          });
          return; // Don't show generic error if redirecting to login
        }
      }
      
      // For network errors or other issues, try to load cached data
      try {
        const cachedData = await dataService.getAnalytics();
        setAnalyticsData(cachedData);
        
        // Show a warning toast about using cached data
        toast({
          title: "Using Cached Data",
          description: "Unable to fetch latest data. Showing cached analytics.",
          variant: "default",
        });
      } catch (fallbackError) {
        console.error('Fallback data loading failed:', fallbackError);
        toast({
          title: "Error Loading Data",
          description: "Failed to load analytics data. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
    
    // Set up auto-refresh every 30 seconds, but only when online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        loadAnalyticsData();
      }
    }, 30000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadAnalyticsData();
    toast({
      title: "Data Refreshed",
      description: "Analytics data has been updated",
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="mb-8">
            <h1 className="section-header">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time insights from marine plastic detection analysis
            </p>
          </div>
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analytics...</p>
            </CardContent>
          </Card>
        </PageTransition>
      </MainLayout>
    );
  }

  if (!analyticsData || analyticsData.stats.totalDetections === 0) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="section-header">Analytics Dashboard</h1>
              <p className="text-muted-foreground">
                Real-time insights from marine plastic detection analysis
              </p>
            </div>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground mb-4">
                Start performing detections to see analytics and insights
              </p>
              <Button asChild>
                <a href="/upload">Start Detection</a>
              </Button>
            </CardContent>
          </Card>
        </PageTransition>
      </MainLayout>
    );
  }

  const stats = [
    {
      title: "Total Detections",
      value: analyticsData.stats.totalDetections.toLocaleString(),
      change: "+0%",
      trend: "up" as const,
      icon: Package,
    },
    {
      title: "Avg Confidence",
      value: `${analyticsData.stats.avgConfidence.toFixed(1)}%`,
      change: "+0%",
      trend: "up" as const,
      icon: Percent,
    },
    {
      title: "This Week",
      value: analyticsData.stats.thisWeek.toString(),
      change: "+0%",
      trend: "up" as const,
      icon: Calendar,
    },
    {
      title: "Detection Rate",
      value: `${analyticsData.stats.detectionRate.toFixed(1)}%`,
      change: "+0%",
      trend: "up" as const,
      icon: TrendingUp,
    },
  ];
  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="section-header">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time insights from marine plastic detection analysis
              {!isOnline && (
                <span className="ml-2 inline-flex items-center gap-1 text-warning">
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                  Offline - Using cached data
                </span>
              )}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="glass-card hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg ocean-gradient flex items-center justify-center">
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        stat.trend === "up" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {stat.change}
                    </span>
                    <span className="text-sm text-muted-foreground">vs last week</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Detection Trend */}
          {analyticsData.trendData.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Detection Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.trendData}>
                        <defs>
                          <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(203, 77%, 26%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(203, 77%, 26%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="detections"
                          stroke="hsl(203, 77%, 26%)"
                          strokeWidth={2}
                          fill="url(#colorDetections)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className="glass-card h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Detection Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No trend data available</p>
              </CardContent>
            </Card>
          )}

          {/* Class Distribution */}
          {analyticsData.classDistribution.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Class Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData.classDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {analyticsData.classDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {analyticsData.classDistribution.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className="glass-card h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Class Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No distribution data available</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Object Counts Bar Chart */}
        {analyticsData.objectCounts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Objects by Class (Total Count)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.objectCounts}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="class" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(170, 50%, 45%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Objects by Class (Total Count)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No object count data available</p>
            </CardContent>
          </Card>
        )}
      </PageTransition>
    </MainLayout>
  );
}
