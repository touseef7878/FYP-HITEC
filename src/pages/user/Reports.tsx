import { useState } from "react";
import { motion } from "framer-motion";
import logger from '@/utils/logger';
import {
  FileText, Download, Calendar, CheckCircle,
  Loader2, Eye, FileX, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadPDFReport, viewPDFReport } from "@/utils/generateReport";
import { queryKeys } from "@/lib/queryKeys";
import ENV from "@/config/env";

const API_URL = ENV.API_URL;

interface Report {
  id: string;
  title: string;
  report_type: string;
  created_at: string;
  status: string;
  size: string;
  data_range_start?: string;
  data_range_end?: string;
}

async function fetchReports(token: string): Promise<Report[]> {
  const res = await fetch(`${API_URL}/api/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error("API returned success=false");
  return data.reports.map((r: any) => ({
    id: r.id.toString(),
    title: r.title,
    report_type: r.report_type,
    created_at: r.created_at,
    status: r.status,
    size: r.size,
    data_range_start: r.data_range_start,
    data_range_end: r.data_range_end,
  }));
}

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType]     = useState<string>("detection");
  const [customTitle, setCustomTitle]   = useState<string>("");
  const [dateRange, setDateRange]       = useState<number>(30);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportToDelete, setReportToDelete]     = useState<Report | null>(null);
  const [isDeleting, setIsDeleting]             = useState(false);
  const { toast }       = useToast();
  const { token }       = useAuth();
  const queryClient     = useQueryClient();

  // ── React Query ─────────────────────────────────────────────────────────────
  const {
    data: reports = [],
    isLoading,
    isFetching,
  } = useQuery<Report[]>({
    queryKey: queryKeys.reports(),
    queryFn:  () => fetchReports(token!),
    enabled:  !!token,
    staleTime: 30 * 1000,
    gcTime:    5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const handleGenerateReport = async () => {
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please login to generate reports",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch(`${API_URL}/api/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_type: reportType,
          title: customTitle || undefined,
          date_range_days: dateRange,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again to generate reports",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.detail || data.message || 'Failed to generate report');
      }
      
      if (data.success && data.report) {
        // Optimistic update — prepend new report to React Query cache immediately
        const newReport: Report = {
          id: data.report.id.toString(),
          title: data.report.title,
          report_type: data.report.report_type,
          created_at: data.report.created_at,
          status: "ready",
          size: "1.2 MB",
        };
        queryClient.setQueryData<Report[]>(queryKeys.reports(), (old = []) => [newReport, ...old]);

        toast({
          title: "Report Generated Successfully",
          description: "Your report is ready. Click View to preview or Download to save.",
        });
        setCustomTitle("");
      } else {
        throw new Error(data.message || "Report generation returned invalid data");
      }
    } catch (error: any) {
      logger.error('Error generating report:', error);
      
      let errorMessage = "Failed to generate report. Please try again.";
      
      if (error.message.includes("No detection data available")) {
        errorMessage = "No detection data found. Please perform some detections first.";
      } else if (error.message.includes("No prediction data available")) {
        errorMessage = "No prediction data found. Please generate some LSTM predictions first.";
      } else if (error.message.includes("No data available")) {
        errorMessage = "No data available. Please perform detections or generate predictions first.";
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteReport = (report: Report) => {
    setReportToDelete(report);
    setShowDeleteDialog(true);
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
    
    setIsDeleting(true);
    try {
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to delete reports",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${API_URL}/api/user/reports/${reportToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete report');
      }

      // Optimistic update — remove from React Query cache immediately
      queryClient.setQueryData<Report[]>(queryKeys.reports(), (old = []) =>
        old.filter((r) => r.id !== reportToDelete.id)
      );

      toast({
        title: "Report Deleted",
        description: `"${reportToDelete.title}" has been permanently deleted`,
      });

    } catch (error: any) {
      logger.error('Error deleting report:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setReportToDelete(null);
    }
  };

  const handleViewReport = (report: Report) => {
    viewPDFReport(report.title, report.id);
    toast({
      title: "Opening Report",
      description: "Generating PDF from report data...",
    });
  };

  const handleDownloadReport = (report: Report) => {
    downloadPDFReport(report.title, report.id);
    toast({
      title: "Downloading Report",
      description: `${report.title} is being generated...`,
    });
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'detection': return 'YOLO Detection';
      case 'prediction': return 'LSTM Prediction';
      case 'both':
      case 'custom': return 'Comprehensive';
      default: return type;
    }
  };

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case 'detection': return 'default';
      case 'prediction': return 'secondary';
      case 'both':
      case 'custom': return 'outline';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 sm:mb-6">
              <h1 className="section-header mb-1">Reports</h1>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                Generate and download PDF analysis reports
              </p>
            </div>
            <Card className="glass-card">
              <CardContent className="py-14 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground text-sm font-medium">Loading reports…</p>
              </CardContent>
            </Card>
          </div>
        </PageTransition>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="section-header mb-1">Reports</h1>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                Generate and download PDF analysis reports
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.reports() })}
              disabled={isFetching}
              className="flex-shrink-0 font-semibold text-[12.5px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Generate Report Card */}
          <Card className="glass-card mb-5 sm:mb-8 overflow-hidden">
            <CardContent className="py-5 sm:py-8 px-4 sm:px-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ocean-gradient flex items-center justify-center flex-shrink-0 shadow-glow">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-base sm:text-xl font-bold mb-1 tracking-tight">Generate New Report</h2>
                    <p className="text-muted-foreground text-[12px] sm:text-[13px] mb-3 font-medium">
                      Create a PDF report with detection statistics, charts, and analysis.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Detection Summary", "Class Distribution", "Trend Analysis", "LSTM Predictions"].map(b => (
                        <Badge key={b} variant="secondary" className="text-[11px] font-semibold">{b}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Config */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 sm:p-4 bg-muted/40 rounded-2xl">
                  <div className="space-y-1.5">
                    <Label htmlFor="report-type" className="text-[12px] sm:text-[13px] font-bold">Report Type</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger className="h-8 sm:h-9 text-[12px] sm:text-[13px] font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="detection">YOLO Detection Only</SelectItem>
                        <SelectItem value="prediction">LSTM Prediction Only</SelectItem>
                        <SelectItem value="both">Comprehensive (Both)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date-range" className="text-[12px] sm:text-[13px] font-bold">Date Range</Label>
                    <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(parseInt(v))}>
                      <SelectTrigger className="h-8 sm:h-9 text-[12px] sm:text-[13px] font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="365">Last year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-title" className="text-[12px] sm:text-[13px] font-bold">Custom Title</Label>
                    <Input
                      id="custom-title"
                      placeholder="Optional title..."
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="h-8 sm:h-9 text-[12px] sm:text-[13px] font-medium"
                    />
                  </div>
                </div>

                <Button
                  size="default"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full sm:w-auto sm:self-center text-[13px] font-bold"
                >
                  {isGenerating
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                    : <><FileText className="mr-2 h-4 w-4" />Generate {getReportTypeLabel(reportType)} Report</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Report History */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display text-[15px] font-bold tracking-tight">Report History</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="py-12 text-center">
                  <FileX className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <h3 className="font-display text-base font-bold mb-2 tracking-tight">No Reports Generated</h3>
                  <p className="text-muted-foreground text-[13px] mb-4 font-medium">
                    Generate your first report to see it here
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {reports.map((report) => (
                    <motion.div
                      key={report.id}
                      variants={fadeInUp}
                      className="flex items-center gap-3 p-3 sm:p-4 bg-muted/40 rounded-2xl hover:bg-muted/60 transition-colors"
                    >
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-semibold truncate text-[12.5px] sm:text-[13.5px] tracking-tight">{report.title}</h3>
                          <Badge variant={getReportTypeBadge(report.report_type) as any} className="text-[10px] px-1.5 py-0 flex-shrink-0 font-bold">
                            {getReportTypeLabel(report.report_type)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(report.created_at).toLocaleDateString()}
                          </span>
                          <span>{report.size}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:flex items-center gap-1 font-bold">
                          <CheckCircle className="h-3 w-3" />
                          Ready
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleViewReport(report)} title="View">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleDownloadReport(report)} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteReport(report)} title="Delete">
                          <FileX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Report
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>"{reportToDelete?.title}"</strong>? 
                This will permanently remove the report and its PDF file. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteReport}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}