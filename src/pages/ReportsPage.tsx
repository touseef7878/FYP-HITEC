import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { downloadPDFReport, viewPDFReport } from "@/lib/generateReport";

interface Report {
  id: string;
  name: string;
  date: string;
  time: string;
  size: string;
  status: "ready" | "generating";
}

// Initial report history
const initialReports: Report[] = [
  {
    id: "rep_001",
    name: "Monthly Analysis Report - January 2024",
    date: "2024-01-15",
    time: "14:32",
    size: "2.4 MB",
    status: "ready",
  },
  {
    id: "rep_002",
    name: "Pacific Region Summary Q4 2023",
    date: "2024-01-10",
    time: "09:15",
    size: "1.8 MB",
    status: "ready",
  },
  {
    id: "rep_003",
    name: "Detection Statistics Overview",
    date: "2024-01-05",
    time: "16:45",
    size: "956 KB",
    status: "ready",
  },
];

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
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
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
