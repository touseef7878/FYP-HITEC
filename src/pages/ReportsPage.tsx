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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { downloadPDFReport, viewPDFReport } from "@/lib/generateReport";
import { dataService } from "@/lib/dataService";

interface Report {
  id: string;
  name: string;
  date: string;
  time: string;
  size: string;
  status: "ready" | "generating";
}

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load reports from localStorage
  useEffect(() => {
    const loadReports = () => {
      try {
        const savedReports = localStorage.getItem('generatedReports');
        if (savedReports) {
          setReports(JSON.parse(savedReports));
        }
      } catch (error) {
        console.error('Error loading reports:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, []);

  // Save reports to localStorage whenever reports change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('generatedReports', JSON.stringify(reports));
    }
  }, [reports, isLoading]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    try {
      // Check if we have analytics data to generate report from
      const analytics = dataService.getAnalytics();
      if (analytics.stats.totalDetections === 0) {
        toast({
          title: "No Data Available",
          description: "Please perform some detections first to generate a report",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const now = new Date();
      const newReport: Report = {
        id: `rep_${Date.now()}`,
        name: `Detection Report - ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        date: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        size: "1.2 MB",
        status: "ready",
      };
      
      setReports((prev) => [newReport, ...prev]);
      setIsGenerating(false);
      
      toast({
        title: "Report Generated",
        description: "Your report is ready. Click View to preview or Download to save.",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewReport = (reportName: string) => {
    viewPDFReport(reportName);
    toast({
      title: "Opening Report",
      description: "Report opened in new tab.",
    });
  };

  const handleDownloadReport = (reportName: string) => {
    downloadPDFReport(reportName);
    toast({
      title: "Report Downloaded",
      description: `${reportName} has been downloaded.`,
    });
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
              <div className="flex flex-col md:flex-row items-center gap-6">
                <motion.div
                  animate={isGenerating ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: isGenerating ? Infinity : 0, ease: "linear" }}
                  className="w-20 h-20 rounded-2xl ocean-gradient flex items-center justify-center flex-shrink-0"
                >
                  <FileText className="h-10 w-10 text-white" />
                </motion.div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-xl font-bold mb-2">Generate New Report</h2>
                  <p className="text-muted-foreground mb-4">
                    Create a comprehensive PDF report with all detection statistics,
                    charts, and analysis from your data.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <Badge variant="secondary">Detection Summary</Badge>
                    <Badge variant="secondary">Class Distribution</Badge>
                    <Badge variant="secondary">Trend Analysis</Badge>
                    <Badge variant="secondary">Hotspot Map</Badge>
                  </div>
                </div>
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
                      Generate Report
                    </>
                  )}
                </Button>
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
                        <h3 className="font-medium truncate">{report.name}</h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {report.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {report.time}
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
                          onClick={() => handleViewReport(report.name)}
                          title="View Report"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownloadReport(report.name)}
                          title="Download Report"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}