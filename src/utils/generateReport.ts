/**
 * PDF Report Generator
 * Uses real data from the backend API report object.
 * Falls back to localStorage analytics for detection stats.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ENV from "@/config/env";

const API_URL = ENV.API_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocalAnalytics() {
  try {
    const raw = localStorage.getItem("analyticsData");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalHistory() {
  try {
    const raw = localStorage.getItem("detectionHistory");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Core PDF builder ──────────────────────────────────────────────────────────

function buildPDF(reportTitle: string, reportData: any): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Pull data from backend report or fall back to localStorage
  const detAnalytics = reportData?.detection_analytics;
  const predAnalytics = reportData?.prediction_analytics;
  const recommendations: any[] = reportData?.recommendations || [];
  const execSummary: string = reportData?.executive_summary || "";
  const reportType: string = reportData?.report_type || "detection";

  // Fallback to localStorage analytics for detection stats
  const localAnalytics = getLocalAnalytics();
  const localHistory = getLocalHistory();

  const detStats = detAnalytics?.summary || localAnalytics?.stats || {
    total_detections: localAnalytics?.stats?.totalDetections || 0,
    avg_confidence: localAnalytics?.stats?.avgConfidence || 0,
    detections_this_week: localAnalytics?.stats?.thisWeek || 0,
    total_files_processed: localHistory.length,
  };

  const classAnalysis: any[] = detAnalytics?.class_analysis ||
    (localAnalytics?.classDistribution || []).map((c: any) => ({
      class_name: c.name,
      total_count: c.value,
      percentage: detStats.total_detections > 0
        ? ((c.value / detStats.total_detections) * 100).toFixed(1)
        : "0",
      avg_confidence: 0,
    }));

  const regionalStats: any[] = predAnalytics?.regional_analysis || [];
  const predSummary = predAnalytics?.summary || {};
  const riskAssessment = predAnalytics?.risk_assessment || {};

  let y = 20;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(20, 78, 106);
  doc.rect(0, 0, pw, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MARINE PLASTIC DETECTION", 14, 22);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text("Comprehensive Analysis Report", 14, 33);
  doc.setFontSize(9);
  doc.text(today, pw - 14, 18, { align: "right" });
  doc.text(reportTitle, pw - 14, 28, { align: "right" });
  doc.text("OceanGuard AI Platform", pw - 14, 38, { align: "right" });

  y = 62;

  // ── Executive Summary ────────────────────────────────────────────────────────
  doc.setTextColor(20, 78, 106);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("EXECUTIVE SUMMARY", 14, y);
  y += 8;

  const summaryText = execSummary ||
    (detStats.total_detections === 0
      ? "No detection data available yet. Perform detections to populate this report."
      : `Analysis of ${detStats.total_detections} marine debris detections across ${detStats.total_files_processed} sessions with ${Number(detStats.avg_confidence).toFixed(1)}% average confidence.`);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const splitSummary = doc.splitTextToSize(summaryText, pw - 28);
  doc.text(splitSummary, 14, y);
  y += splitSummary.length * 5 + 12;

  // ── Section 1: YOLO Detection Analysis ──────────────────────────────────────
  if (reportType === "detection" || reportType === "both" || reportType === "custom") {
    doc.setTextColor(20, 78, 106);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("1. YOLO DETECTION ANALYSIS", 14, y);
    y += 8;

    // Key metrics table
    doc.setFontSize(12);
    doc.text("1.1 Key Performance Metrics", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Objects Detected", String(detStats.total_detections || 0)],
        ["Average Detection Confidence", `${Number(detStats.avg_confidence || 0).toFixed(1)}%`],
        ["Detections This Week", String(detStats.detections_this_week || 0)],
        ["Total Files Processed", String(detStats.total_files_processed || localHistory.length)],
        ["Avg Processing Time (s)", String(Number(detStats.avg_processing_time || 0).toFixed(2))],
        ["Pollution Severity", detAnalytics?.environmental_impact?.pollution_severity || "N/A"],
        ["Confidence Reliability", detAnalytics?.environmental_impact?.confidence_reliability || "N/A"],
      ],
      theme: "striped",
      headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // Class distribution
    if (classAnalysis.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 78, 106);
      doc.text("1.2 Plastic Waste Classification", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Plastic Type", "Count", "% of Total", "Avg Confidence"]],
        body: classAnalysis.map((c: any) => [
          c.class_name,
          String(c.total_count),
          `${c.percentage}%`,
          `${Number(c.avg_confidence || 0).toFixed(1)}%`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Bar chart visualization
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text("1.3 Distribution Visualization", 14, y);
      y += 8;
      const maxCount = Math.max(...classAnalysis.map((c: any) => c.total_count || 0), 1);
      classAnalysis.slice(0, 8).forEach((item: any, i: number) => {
        const bw = ((item.total_count || 0) / maxCount) * 110;
        doc.setFillColor(240, 240, 240);
        doc.rect(70, y + i * 14, 110, 10, "F");
        doc.setFillColor(46, 160, 134);
        doc.rect(70, y + i * 14, bw, 10, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(item.class_name, 14, y + i * 14 + 7);
        doc.text(String(item.total_count), 73 + bw, y + i * 14 + 7);
      });
      y += classAnalysis.slice(0, 8).length * 14 + 12;
    }

    // Recent detections timeline
    const timeline: any[] = detAnalytics?.detection_timeline || localHistory.slice(0, 10);
    if (timeline.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 78, 106);
      doc.text("1.4 Recent Detection Timeline", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["File / ID", "Date", "Objects Found", "Processing Time (s)"]],
        body: timeline.map((d: any) => [
          d.filename || String(d.id || ""),
          (d.date || d.upload_date || "").toString().slice(0, 10),
          String(d.objects_found ?? d.objects ?? 0),
          String(Number(d.processing_time || 0).toFixed(2)),
        ]),
        theme: "striped",
        headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // ── Section 2: LSTM Prediction Analysis ─────────────────────────────────────
  if (reportType === "prediction" || reportType === "both" || reportType === "custom") {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setTextColor(20, 78, 106);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. LSTM POLLUTION PREDICTION ANALYSIS", 14, y);
    y += 8;

    // Prediction summary
    doc.setFontSize(12);
    doc.text("2.1 Prediction Summary", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Predictions Generated", String(predSummary.total_predictions || 0)],
        ["Ocean Regions Analyzed", String(predSummary.regions_analyzed || 0)],
        ["Overall Avg Pollution Level", `${Number(predSummary.overall_avg_pollution || 0).toFixed(1)}`],
        ["Analysis Period", predSummary.date_range || "N/A"],
        ["Model Version", predSummary.model_version || "N/A"],
        ["Prediction Reliability", predSummary.prediction_reliability || "N/A"],
        ["Overall Ocean Health", riskAssessment.overall_ocean_health || "N/A"],
        ["Highest Risk Region", riskAssessment.highest_risk_region || "N/A"],
      ],
      theme: "striped",
      headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // Regional analysis
    if (regionalStats.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 78, 106);
      doc.text("2.2 Regional Pollution Forecasts", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Region", "Avg Pollution", "Max", "Min", "Trend", "Risk Level", "Predictions"]],
        body: regionalStats.map((r: any) => [
          r.region,
          Number(r.avg_pollution_level || 0).toFixed(1),
          Number(r.max_pollution_level || 0).toFixed(1),
          Number(r.min_pollution_level || 0).toFixed(1),
          r.trend || "N/A",
          r.risk_level || "N/A",
          String(r.total_predictions || 0),
        ]),
        theme: "striped",
        headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    // Future outlook
    const outlook = predAnalytics?.future_outlook;
    if (outlook) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 78, 106);
      doc.text("2.3 Future Outlook", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Trend Category", "Regions"]],
        body: [
          ["Increasing Pollution", (outlook.increasing_trend_regions || []).join(", ") || "None"],
          ["Decreasing Pollution", (outlook.decreasing_trend_regions || []).join(", ") || "None"],
          ["Stable Pollution", (outlook.stable_regions || []).join(", ") || "None"],
          ["Critical Risk Regions", (riskAssessment.critical_regions || []).join(", ") || "None"],
        ],
        theme: "striped",
        headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // ── Section 3: Recommendations ───────────────────────────────────────────────
  if (recommendations.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setTextColor(20, 78, 106);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("3. RECOMMENDATIONS", 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Priority", "Category", "Recommendation"]],
      body: recommendations.map((r: any) => [
        r.priority || "Medium",
        r.category || "General",
        r.recommendation || "",
      ]),
      theme: "striped",
      headStyles: { fillColor: [20, 78, 106], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { cellWidth: 100 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // Action items
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 78, 106);
    doc.text("3.1 Action Items", 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    recommendations.forEach((r: any) => {
      (r.action_items || []).forEach((item: string) => {
        if (y > ph - 30) { doc.addPage(); y = 20; }
        doc.text(`• [${r.priority}] ${item}`, 14, y);
        y += 5;
      });
    });
    y += 8;
  }

  // ── Footer on all pages ───────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(20, 78, 106);
    doc.rect(0, ph - 20, pw, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("Generated by OceanGuard AI — Marine Plastic Detection Platform", 14, ph - 12);
    doc.text(`${today} | Page ${p} of ${totalPages}`, pw - 14, ph - 12, { align: "right" });
    doc.text("Confidential — For Environmental Research Use Only", 14, ph - 6);
  }

  return doc;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch report data from backend and generate PDF blob URL for viewing.
 * Falls back to localStorage data if reportId is not provided.
 */
export async function viewPDFReport(reportTitle: string, reportId?: string | number): Promise<void> {
  const reportData = await _fetchReportData(reportId);
  const doc = buildPDF(reportTitle, reportData);
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
}

/**
 * Fetch report data from backend and download as PDF file.
 */
export async function downloadPDFReport(reportTitle: string, reportId?: string | number): Promise<void> {
  const reportData = await _fetchReportData(reportId);
  const doc = buildPDF(reportTitle, reportData);
  const fileName = reportTitle.replace(/\s+/g, "_").toLowerCase() + ".pdf";
  doc.save(fileName);
}

async function _fetchReportData(reportId?: string | number): Promise<any> {
  if (!reportId) return null;
  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`${API_URL}/api/reports/${reportId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Backend returns { success, report: { ..., metadata: { data: {...} } } }
    const meta = json?.report?.metadata;
    if (meta?.data) return meta.data;
    return meta || null;
  } catch {
    return null;
  }
}
