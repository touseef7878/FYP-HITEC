import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
  Eye,
  FileX,
  Settings,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { downloadPDFReport, viewPDFReport } from "@/lib/generateReport";

const API_URL = "http://localhost:8000";

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

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<string>("detection");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [dateRange, setDateRange] = useState<number>(30);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { token } = useAuth();

  // Load reports from backend
  useEffect(() => {
    const loadReports = async () => {
      try {
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/reports`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setReports(data.reports.map((report: any) => ({
              id: report.id.toString(),
              title: report.title,
              report_type: report.report_type,
              created_at: report.created_at,
              status: report.status,
              size: report.size,
              data_range_start: report.data_range_start,
              data_range_end: report.data_range_end,
            })));
          }
        } else if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again to view reports",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading reports:', error);
        toast({
          title: "Error Loading Reports",
          description: "Failed to load reports from server. Please check your connection.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, [token, toast]);

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
        // Add new report to the list
        const newReport: Report = {
          id: data.report.id.toString(),
          title: data.report.title,
          report_type: data.report.report_type,
          created_at: data.report.created_at,
          status: 'ready',
          size: '1.2 MB',
        };
        
        setReports((prev) => [newReport, ...prev]);
        
        toast({
          title: "Report Generated Successfully",
          description: "Your report is ready. Click View to preview or Download to save.",
        });

        // Reset form
        setCustomTitle("");
      } else {
        throw new Error(data.message || 'Report generation returned invalid data');
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      
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
      const token = localStorage.getItem('auth_token');
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

      // Remove from local state only after successful backend deletion
      setReports(prev => prev.filter(report => report.id !== reportToDelete.id));
      
      toast({
        title: "Report Deleted",
        description: `"${reportToDelete.title}" has been permanently deleted`,
      });

    } catch (error: any) {
      console.error('Error deleting report:', error);
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

  const handleViewReport = (reportTitle: string) => {
    viewPDFReport(reportTitle);
    toast({
      title: "Opening Report",
      description: "Report opened in new tab.",
    });
  };

  const handleDownloadReport = (reportTitle: string) => {
    downloadPDFReport(reportTitle);
    toast({
      title: "Report Downloaded",
      description: `${reportTitle} has been downloaded.`,
    });
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'detection': return 'YOLO Detection';
      case 'prediction': return 'LSTM Prediction';
      case 'both': return 'Comprehensive';
      default: return type;
    }
  };

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case 'detection': return 'default';
      case 'prediction': return 'secondary';
      case 'both': return 'outline';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="section-header">Reports</h1>
              <p className="text-muted-foreground">
                Generate and download comprehensive analysis reports
              </p>
            </div>
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading reports...</p>
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
          <div className="mb-8">
            <h1 className="section-header">Reports</h1>
            <p className="text-muted-foreground">
              Generate and download comprehensive analysis reports
            </p>
          </div>

          {/* Generate Report Card */}
          <Card className="glass-card mb-8 overflow-hidden">
            <div className="absolute inset-0 ocean-gradient opacity-5" />
            <CardContent className="py-8 relative">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <motion.div
                    animate={isGenerating ? { rotate: 360 } : {}}
                    transition={{ duration: 2, repeat: isGenerating ? Infinity : 0, ease: "linear" }}
                    className="w-20 h-20 rounded-2xl ocean-gradient flex items-center justify-center flex-shrink-0"
                  >
                    <FileText className="h-10 w-10 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2">Generate New Report</h2>
                    <p className="text-muted-foreground mb-4">
                      Create a comprehensive PDF report with detection statistics,
                      charts, and analysis from your data.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="secondary">Detection Summary</Badge>
                      <Badge variant="secondary">Class Distribution</Badge>
                      <Badge variant="secondary">Trend Analysis</Badge>
                      <Badge variant="secondary">LSTM Predictions</Badge>
                    </div>
                  </div>
                </div>

                {/* Report Configuration */}
                <div className="grid md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="report-type">Report Type</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="detection">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            YOLO Detection Only
                          </div>
                        </SelectItem>
                        <SelectItem value="prediction">
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            LSTM Prediction Only
                          </div>
                        </SelectItem>
                        <SelectItem value="both">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <Settings className="h-4 w-4" />
                            Comprehensive (Both)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date-range">Date Range (Days)</Label>
                    <Select value={dateRange.toString()} onValueChange={(value) => setDateRange(parseInt(value))}>
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="custom-title">Custom Title (Optional)</Label>
                    <Input
                      id="custom-title"
                      placeholder="Enter custom report title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="flex-shrink-0"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-5 w-5" />
                        Generate {getReportTypeLabel(reportType)} Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report History */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Report History</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="py-12 text-center">
                  <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Reports Generated</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate your first report to see it here
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {reports.map((report) => (
                    <motion.div
                      key={report.id}
                      variants={fadeInUp}
                      className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{report.title}</h3>
                          <Badge variant={getReportTypeBadge(report.report_type) as any}>
                            {getReportTypeLabel(report.report_type)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(report.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(report.created_at).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              hour12: false 
                            })}
                          </span>
                          <span>{report.size}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Ready
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewReport(report.title)}
                          title="View Report"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownloadReport(report.title)}
                          title="Download Report"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteReport(report)}
                          title="Delete Report"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <FileX className="h-4 w-4" />
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