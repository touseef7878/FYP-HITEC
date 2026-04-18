import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, Package, Percent, Calendar,
  ArrowUpRight, Database, RefreshCw, WifiOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { dataService, AnalyticsData } from "@/services/data.service";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

export default function DashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: analyticsData, isLoading, isError, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => dataService.getAnalytics(),
    staleTime: 5 * 60 * 1000,       // 5 min — don't refetch if fresh
    gcTime: 10 * 60 * 1000,          // 10 min cache
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    await refetch();
    toast({ title: "Data Refreshed", description: "Analytics updated." });
  }, [queryClient, refetch, toast]);

  // Re-fetch when a detection completes (fired from Upload page)
  const handleDetectionComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  }, [queryClient]);

  // Register event listener once on mount
  useEffect(() => {
    window.addEventListener("detectionComplete", handleDetectionComplete);
    return () => window.removeEventListener("detectionComplete", handleDetectionComplete);
  }, [handleDetectionComplete]);

  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="mb-8">
            <h1 className="section-header">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Comprehensive insights from detection analysis</p>
          </div>
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading analytics...</p>
            </CardContent>
          </Card>
        </PageTransition>
      </MainLayout>
    );
  }

  const isEmpty = !analyticsData || analyticsData.stats.totalDetections === 0;

  if (isEmpty) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="section-header">Analytics Dashboard</h1>
              <p className="text-muted-foreground">Comprehensive insights from detection analysis</p>
            </div>
            <Button onClick={handleRefresh} variant="outline" disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          {isError && (
            <div className="flex items-center gap-2 text-destructive mb-4 text-sm">
              <WifiOff className="h-4 w-4" />
              Could not reach server — showing cached data
            </div>
          )}
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
    { title: "Total Detections", value: analyticsData.stats.totalDetections.toLocaleString(), icon: Package },
    { title: "Avg Confidence", value: `${analyticsData.stats.avgConfidence.toFixed(1)}%`, icon: Percent },
    { title: "This Week", value: analyticsData.stats.thisWeek.toString(), icon: Calendar },
    { title: "Detection Rate", value: `${analyticsData.stats.detectionRate.toFixed(1)}%`, icon: TrendingUp },
  ];

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-5 sm:mb-6 flex flex-col xs:flex-row xs:items-center justify-between gap-3">
          <div>
            <h1 className="section-header mb-1">Analytics Dashboard</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Real-time insights from marine plastic detection analysis</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isFetching} className="self-start xs:self-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="glass-card hover-lift">
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{stat.title}</p>
                    <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg ocean-gradient flex items-center justify-center flex-shrink-0 ml-2">
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs sm:text-sm font-medium text-success">Active</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">monitoring</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Detection Trend */}
          <Card className="glass-card h-full">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Detection Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsData.trendData.length > 0 ? (
                <div className="h-[220px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.trendData}>
                      <defs>
                        <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(203, 77%, 26%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(203, 77%, 26%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="detections" stroke="hsl(203, 77%, 26%)" strokeWidth={2} fill="url(#colorDetections)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[220px] sm:h-[280px]">
                  <p className="text-muted-foreground text-sm">No trend data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Distribution */}
          <Card className="glass-card h-full">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Class Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsData.classDistribution.length > 0 ? (
                <>
                  <div className="h-[180px] sm:h-[220px] flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={analyticsData.classDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                          {analyticsData.classDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-3">
                    {analyticsData.classDistribution.map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[220px] sm:h-[280px]">
                  <p className="text-muted-foreground text-sm">No distribution data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Object Counts */}
        <Card className="glass-card">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base">Objects by Class (Total Count)</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.objectCounts.length > 0 ? (
              <div className="h-[220px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.objectCounts}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="class" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="hsl(170, 50%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[220px] sm:h-[280px]">
                <p className="text-muted-foreground text-sm">No object count data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </PageTransition>
    </MainLayout>
  );
}
