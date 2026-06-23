/**
 * PDF Report Generator
 * - "detection" -> YOLO detection data only
 * - "prediction" -> LSTM + GRU prediction data
 * - "both" / "custom" -> combined (YOLO + LSTM + GRU)
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GoogleGenAI } from "@google/genai";
import ENV from "@/config/env";

const API_URL = ENV.API_URL;

const PDF = {
  navy: [15, 58, 82] as [number, number, number],
  teal: [18, 132, 122] as [number, number, number],
  cyan: [38, 166, 183] as [number, number, number],
  slate: [64, 79, 96] as [number, number, number],
  muted: [107, 120, 134] as [number, number, number],
  line: [220, 228, 235] as [number, number, number],
  panel: [247, 250, 252] as [number, number, number],
  softBlue: [232, 244, 250] as [number, number, number],
  red: [214, 73, 73] as [number, number, number],
  orange: [229, 132, 44] as [number, number, number],
  amber: [218, 176, 48] as [number, number, number],
  green: [38, 154, 120] as [number, number, number],
};

// Zebra-stripe tint: 5% of primary theme color (navy #0f3a52) on white → very light blue-gray
const ZEBRA_TINT: [number, number, number] = [243, 247, 250];

const TABLE_THEME = {
  theme: "plain" as const,
  styles: {
    font: "helvetica",
    // Fix 1 & 3: Body text 10pt Dark Gray, cell padding 8px top/bottom 10px left/right
    fontSize: 10,
    cellPadding: { top: 2.83, right: 3.53, bottom: 2.83, left: 3.53 }, // 8px = 2.83mm, 10px = 3.53mm
    lineColor: PDF.line,
    lineWidth: 0.1,
    // Fix 1: Dark Gray for body text readability (not slate which is too blue)
    textColor: [50, 50, 50] as [number, number, number],
  },
  headStyles: {
    fillColor: PDF.navy,
    textColor: [255, 255, 255] as [number, number, number],
    // Fix 1: H2-equivalent header — bold, slightly larger
    fontSize: 10,
    fontStyle: "bold" as const,
    cellPadding: { top: 2.83, right: 3.53, bottom: 2.83, left: 3.53 },
  },
  // Fix 3: Alternating row zebra stripe — 5% tint of primary navy
  alternateRowStyles: {
    fillColor: ZEBRA_TINT,
  },
  margin: { left: 14, right: 14 },
};

const GUIDANCE_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
];

let guidanceAI: GoogleGenAI | null = null;

function getGuidanceAI(): GoogleGenAI | null {
  if (!ENV.GEMINI_API_KEY) return null;
  if (!guidanceAI) guidanceAI = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
  return guidanceAI;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("AI guidance timed out")), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

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

function riskFromPollution(value: number): string {
  if (value > 80) return "Critical";
  if (value > 60) return "High";
  if (value > 40) return "Medium";
  return "Low";
}

function formatModelLabel(value?: string): string {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("gru")) return "GRU";
  return "LSTM";
}

function hasPredictionData(reportData: any): boolean {
  const summary = reportData?.prediction_analytics?.summary;
  return Number(summary?.total_predictions || 0) > 0;
}

function ensureSpace(doc: jsPDF, y: number, height = 36): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + height > ph - 24) {
    doc.addPage();
    return 18;
  }
  return y;
}

function setRGB(doc: jsPDF, color: [number, number, number], target: "text" | "fill" | "draw" = "text") {
  if (target === "text") doc.setTextColor(color[0], color[1], color[2]);
  if (target === "fill") doc.setFillColor(color[0], color[1], color[2]);
  if (target === "draw") doc.setDrawColor(color[0], color[1], color[2]);
}

function intensityColor(intensity?: string): [number, number, number] {
  switch (String(intensity || "").toLowerCase()) {
    case "critical": return PDF.red;
    case "high": return PDF.orange;
    case "medium":
    case "moderate": return PDF.amber;
    case "low": return PDF.green;
    default: return PDF.teal;
  }
}

// Fix 1: Clear typographic hierarchy
// H1 = 22pt semi-bold, Primary Dark Blue, 12pt space after
// H2 = 14pt medium, Charcoal Gray, 8pt space after
// Eyebrow = 8pt bold teal uppercase (category label above H1)
function addSectionTitle(doc: jsPDF, title: string, y: number, eyebrow?: string): number {
  y = ensureSpace(doc, y, 36);

  // Eyebrow label — 7pt bold teal uppercase
  if (eyebrow) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setRGB(doc, PDF.teal);
    doc.text(eyebrow.toUpperCase(), 14, y);
    y += 7; // push H1 clearly below eyebrow
  }

  // H1 title — 14pt bold, Primary Dark Blue
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setRGB(doc, PDF.navy);
  doc.text(title, 14, y);

  // Underline: 6mm below baseline so it clears descenders fully
  const ruleY = y + 5;
  setRGB(doc, PDF.teal, "draw");
  doc.setLineWidth(0.5);
  doc.line(14, ruleY, 80, ruleY);

  // 10mm gap before next content block
  return ruleY + 10;
}

// H2 subsection heading — 12pt medium, Charcoal Gray, with proper space after
function addSubSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRGB(doc, [55, 65, 75] as [number, number, number]); // Charcoal Gray
  doc.text(title, 14, y);
  // 6mm space after H2 before content
  return y + 6;
}

function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 5
): number {
  const lines = doc.splitTextToSize(text || "", width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawKpiCards(
  doc: jsPDF,
  cards: Array<{ label: string; value: string; note?: string; color?: [number, number, number] }>,
  y: number
): number {
  const pw = doc.internal.pageSize.getWidth();
  const gap = 5;
  const x0 = 14;
  const cardW = (pw - 28 - gap * (cards.length - 1)) / cards.length;
  // Fix 2: taller card to accommodate 12px even padding on all sides
  const cardH = 30;
  // 12px ≈ 4.23mm in PDF units
  const pad = 4.23;
  y = ensureSpace(doc, y, cardH + 6);

  cards.forEach((card, i) => {
    const x = x0 + i * (cardW + gap);
    const accent = card.color || PDF.teal;

    // Card background
    setRGB(doc, PDF.panel, "fill");
    setRGB(doc, PDF.line, "draw");
    doc.setLineWidth(0.15);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, "FD");

    // Left accent stripe
    setRGB(doc, accent, "fill");
    doc.roundedRect(x, y, 2.5, cardH, 1.5, 1.5, "F");

    // Label: top-left with 12px padding (pad from left stripe + pad gap)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setRGB(doc, PDF.muted);
    doc.text(card.label.toUpperCase(), x + 2.5 + pad, y + pad + 3.5);

    // Value: horizontally centered, vertically centered in remaining space
    // Fix 2: center the big number both axes
    const valueY = y + cardH / 2 + 1.5; // vertical center nudged for baseline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    setRGB(doc, PDF.navy);
    doc.text(card.value, x + cardW / 2, valueY, { align: "center" });

    // Note: bottom-left with 12px padding from bottom
    if (card.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setRGB(doc, PDF.muted);
      doc.text(card.note, x + 2.5 + pad, y + cardH - pad);
    }
  });

  return y + cardH + 10;
}

function drawHorizontalBars(
  doc: jsPDF,
  title: string,
  rows: Array<{ label: string; value: number; color?: [number, number, number]; suffix?: string }>,
  y: number,
  options: { maxRows?: number; maxValue?: number } = {}
): number {
  const visibleRows = rows.slice(0, options.maxRows ?? 8);
  if (!visibleRows.length) return y;
  const rowH = 10; // a bit taller for readability
  const height = 16 + visibleRows.length * rowH;
  y = ensureSpace(doc, y, height + 6);

  // H2-style bar chart title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRGB(doc, [55, 65, 75] as [number, number, number]);
  doc.text(title, 14, y);
  y += 8;

  const labelW = 50;
  const barX = 14 + labelW;
  const barW = doc.internal.pageSize.getWidth() - barX - 32;
  // Fix 4: reference scale reference line at maxValue (full width = 100%)
  const maxValue = options.maxValue ?? Math.max(...visibleRows.map(row => row.value), 1);

  // Draw a faint scale tick at 0%, 25%, 50%, 75%, 100%
  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const tx = barX + frac * barW;
    setRGB(doc, [200, 210, 218] as [number, number, number], "draw");
    doc.setLineWidth(0.15);
    doc.line(tx, y - 2, tx, y + visibleRows.length * rowH + 2);
  });

  visibleRows.forEach((row) => {
    const fillWidth = Math.max(1.5, (row.value / maxValue) * barW);

    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRGB(doc, PDF.slate);
    doc.text(String(row.label).slice(0, 30), 14, y + 5);

    // Fix 4: Background track — muted light gray, rounded corners 4px ≈ 1.41mm
    setRGB(doc, [224, 231, 237] as [number, number, number], "fill");
    setRGB(doc, [224, 231, 237] as [number, number, number], "draw");
    doc.setLineWidth(0.05);
    doc.roundedRect(barX, y + 1, barW, 5.5, 1.41, 1.41, "FD");

    // Filled bar — same rounded corners
    setRGB(doc, row.color || PDF.teal, "fill");
    doc.roundedRect(barX, y + 1, fillWidth, 5.5, 1.41, 1.41, "F");

    // Value label right of bar
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setRGB(doc, PDF.navy);
    doc.text(
      `${Number(row.value).toFixed(row.value % 1 ? 1 : 0)}${row.suffix || ""}`,
      barX + barW + 3,
      y + 5
    );
    y += rowH;
  });

  return y + 8;
}

function drawDonutChart(
  doc: jsPDF,
  title: string,
  rows: Array<{ label: string; value: number; color: [number, number, number] }>,
  y: number
): number {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return y;
  y = ensureSpace(doc, y, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRGB(doc, [55, 65, 75] as [number, number, number]);
  doc.text(title, 14, y);
  y += 6;

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 78;
      const innerRadius = 44;
      let angle = -Math.PI / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rows.forEach(row => {
        const sweep = (row.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, angle, angle + sweep);
        ctx.arc(cx, cy, innerRadius, angle + sweep, angle, true);
        ctx.closePath();
        ctx.fillStyle = `rgb(${row.color.join(",")})`;
        ctx.fill();
        angle += sweep;
      });
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${PDF.navy.join(",")})`;
      ctx.font = "700 28px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.round(total)), cx, cy);
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 18, y + 2, 34, 34);
    }
  } else {
    setRGB(doc, PDF.teal, "fill");
    doc.circle(35, y + 19, 17, "F");
    setRGB(doc, [255, 255, 255], "fill");
    doc.circle(35, y + 19, 9, "F");
  }

  let legendY = y + 4;
  rows.forEach((row) => {
    setRGB(doc, row.color, "fill");
    doc.roundedRect(64, legendY - 3, 4, 4, 1, 1, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRGB(doc, PDF.slate);
    doc.text(`${row.label}: ${row.value}`, 71, legendY);
    legendY += 6;
  });

  return y + 42;
}

function buildFallbackGuidance(reportData: any): string[] {
  const guidance: string[] = [];
  const detectionSummary = reportData?.detection_analytics?.summary || {};
  const predictionAnalytics = reportData?.prediction_analytics || {};
  const predictionSummary = predictionAnalytics.summary || {};
  const risk = predictionAnalytics.risk_assessment || {};
  const modelsIncluded = predictionSummary.models_included || "LSTM + GRU";
  const avgPollution = Number(predictionSummary.overall_avg_pollution || 0);
  const totalDetections = Number(detectionSummary.total_detections || 0);

  if (totalDetections > 50) {
    guidance.push("Prioritize cleanup planning for high-debris zones and repeat YOLO scans after intervention to verify reduction.");
  } else if (totalDetections > 0) {
    guidance.push("Keep the current image/video detection schedule active and compare new debris counts against this report baseline.");
  }

  if (hasPredictionData(reportData)) {
    guidance.push(`${modelsIncluded} forecasts indicate ${riskFromPollution(avgPollution).toLowerCase()} average pollution pressure; use the regional forecast table to prioritize monitoring.`);
    if (predictionSummary.comparison_ready) {
      guidance.push("Compare LSTM and GRU side by side before action planning; consistent high-risk signals from both models are stronger evidence.");
    } else {
      guidance.push("Generate predictions with model_type=both when possible so future reports include a complete LSTM and GRU comparison.");
    }
    if (risk.highest_risk_region && risk.highest_risk_region !== "None") {
      guidance.push(`Start field checks with ${risk.highest_risk_region}, then compare observed conditions with the next forecast batch.`);
    }
  }

  guidance.push("Refresh environmental data, retrain both models, and regenerate the report before making time-sensitive field decisions.");
  return guidance.slice(0, 4);
}

async function generateAIGuidance(reportData: any): Promise<string[] | null> {
  const ai = getGuidanceAI();
  if (!ai) return null;

  const payload = {
    report_type: reportData?.report_type,
    detection_summary: reportData?.detection_analytics?.summary,
    prediction_summary: reportData?.prediction_analytics?.summary,
    model_comparison: reportData?.prediction_analytics?.model_comparison,
    regional_analysis: (reportData?.prediction_analytics?.regional_analysis || []).slice(0, 5),
    risk_assessment: reportData?.prediction_analytics?.risk_assessment,
  };

  const prompt = `Create 3 concise, practical guidance bullets for a marine pollution PDF report.
Use the data below. Mention LSTM and GRU together when prediction data exists.
Avoid markdown tables and keep each bullet under 22 words.
Return plain lines only.

${JSON.stringify(payload)}`;

  for (const model of GUIDANCE_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction: "You write concise operational guidance for OceanGuard AI marine debris reports.",
            temperature: 0.35,
            maxOutputTokens: 180,
          },
        }),
        5000
      );
      const text = response.text?.trim();
      if (!text) continue;
      const lines = text
        .split("\n")
        .map(line => line.replace(/^[-*\d.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 4);
      if (lines.length > 0) return lines;
    } catch {
      continue;
    }
  }

  return null;
}

function addHeader(doc: jsPDF, reportTitle: string, subtitle: string, today: string) {
  const pw = doc.internal.pageSize.getWidth();

  // Navy background band
  setRGB(doc, PDF.navy, "fill");
  doc.rect(0, 0, pw, 48, "F");

  // Teal accent strip at bottom of header
  setRGB(doc, PDF.teal, "fill");
  doc.rect(0, 48, pw, 2.5, "F");

  // ── Left block: brand name + subtitle + tagline ──
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("OceanGuard AI", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, 14, 23);

  doc.setFontSize(7.5);
  setRGB(doc, [160, 210, 220] as [number, number, number]);
  doc.text("Marine debris detection and pollution forecasting", 14, 31);

  // ── Right block: report title + date + classification ──
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(reportTitle.slice(0, 52), pw - 14, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(today, pw - 14, 23, { align: "right" });

  doc.setFontSize(7.5);
  setRGB(doc, [160, 210, 220] as [number, number, number]);
  doc.text("Confidential research report", pw - 14, 31, { align: "right" });
}

function addFooters(doc: jsPDF, today: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).internal.getNumberOfPages();
  // Fix 5: footer sits at bottom-25mm margin; rule is 0.5pt above footer text
  // ph - 25mm bottom margin; text baseline at ph - 8mm from bottom
  const ruleY = ph - 11;
  const textY = ph - 7;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Fix 5: 0.5pt light gray horizontal rule to cleanly isolate footer
    setRGB(doc, [190, 200, 210] as [number, number, number], "draw");
    doc.setLineWidth(0.176); // 0.5pt = 0.176mm
    doc.line(14, ruleY, pw - 14, ruleY);
    // Fix 5: pipe-separated footer elements
    setRGB(doc, PDF.muted);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      `OceanGuard AI  |  Marine Plastic Detection Platform  |  ${today}`,
      14,
      textY
    );
    doc.text(`Page ${p} of ${totalPages}`, pw - 14, textY, { align: "right" });
  }
}

function buildYOLOSection(
  doc: jsPDF,
  reportData: any,
  sectionNum: number,
  startY: number
): number {
  const detAnalytics = reportData?.detection_analytics;
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

  let y = startY;

  y = addSectionTitle(doc, `${sectionNum}. YOLO Detection Analysis`, y, "Computer Vision");

  y = drawKpiCards(doc, [
    { label: "Objects", value: String(detStats.total_detections || 0), note: "Detected debris", color: PDF.navy },
    { label: "Confidence", value: `${Number(detStats.avg_confidence || 0).toFixed(1)}%`, note: "Average score", color: PDF.teal },
    { label: "Files", value: String(detStats.total_files_processed || localHistory.length), note: "Processed media", color: PDF.cyan },
    { label: "Severity", value: detAnalytics?.environmental_impact?.pollution_severity || "N/A", note: "Current risk", color: intensityColor(detAnalytics?.environmental_impact?.pollution_severity) },
  ], y);

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
    ...TABLE_THEME,
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { cellWidth: 98 } },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (classAnalysis.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = drawHorizontalBars(
      doc,
      `${sectionNum}.1 Plastic Waste Distribution`,
      classAnalysis.map((c: any, index: number) => ({
        label: c.class_name,
        value: Number(c.total_count || 0),
        color: [PDF.teal, PDF.cyan, PDF.navy, PDF.green, PDF.amber, PDF.orange, PDF.red, PDF.slate][index % 8],
      })),
      y,
      { maxRows: 8 }
    );

    y = ensureSpace(doc, y, 42);
    y = addSubSectionTitle(doc, `${sectionNum}.2 Classification Detail`, y);

    autoTable(doc, {
      startY: y,
      head: [["Plastic Type", "Count", "% of Total", "Avg Confidence"]],
      body: classAnalysis.map((c: any) => [
        c.class_name,
        String(c.total_count),
        `${c.percentage}%`,
        `${Number(c.avg_confidence || 0).toFixed(1)}%`,
      ]),
      ...TABLE_THEME,
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  const timeline: any[] = detAnalytics?.detection_timeline || localHistory.slice(0, 10);
  if (timeline.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    y = addSubSectionTitle(doc, `${sectionNum}.3 Recent Detection Timeline`, y);

    autoTable(doc, {
      startY: y,
      head: [["File / ID", "Date", "Objects Found", "Processing Time (s)"]],
      body: timeline.map((d: any) => {
        // Fix 3: truncate file name at 25 chars with ellipsis to prevent layout overflow
        const rawName = d.filename || String(d.id || "");
        const displayName = rawName.length > 25 ? rawName.slice(0, 25) + "…" : rawName;
        return [
          displayName,
          (d.date || d.upload_date || "").toString().slice(0, 10),
          String(d.objects_found ?? d.objects ?? 0),
          String(Number(d.processing_time || 0).toFixed(2)),
        ];
      }),
      ...TABLE_THEME,
      styles: { ...TABLE_THEME.styles, fontSize: 9 },
      // Fix 3: set max width on File/ID column and prevent text overflow
      columnStyles: {
        0: { cellWidth: 55, overflow: "ellipsize" as const },
        1: { cellWidth: 25 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  return y;
}

function buildPredictionSection(
  doc: jsPDF,
  reportData: any,
  sectionNum: number,
  startY: number
): number {
  const predAnalytics = reportData?.prediction_analytics;
  const regionalStats: any[] = predAnalytics?.regional_analysis || [];
  const modelStats: any[] = predAnalytics?.model_comparison || [];
  const predSummary = predAnalytics?.summary || {};
  const riskAssessment = predAnalytics?.risk_assessment || {};

  let y = startY;

  y = addSectionTitle(doc, `${sectionNum}. LSTM + GRU Pollution Forecast`, y, "Time-Series Forecasting");
  y = drawKpiCards(doc, [
    { label: "Predictions", value: String(predSummary.total_predictions || 0), note: "Saved rows", color: PDF.navy },
    { label: "Regions", value: String(predSummary.regions_analyzed || 0), note: "Ocean areas", color: PDF.teal },
    { label: "Avg Level", value: Number(predSummary.overall_avg_pollution || 0).toFixed(1), note: "0-100 index", color: intensityColor(riskFromPollution(Number(predSummary.overall_avg_pollution || 0))) },
    { label: "Models", value: predSummary.models_included || "LSTM + GRU", note: predSummary.comparison_ready ? "Comparison ready" : "Partial data", color: PDF.cyan },
  ], y);

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total Predictions Generated", String(predSummary.total_predictions || 0)],
      ["Ocean Regions Analyzed", String(predSummary.regions_analyzed || 0)],
      ["Overall Avg Pollution Level", `${Number(predSummary.overall_avg_pollution || 0).toFixed(1)}`],
      ["Analysis Period", predSummary.date_range || "N/A"],
      ["Models Included", predSummary.models_included || predSummary.models_available || "LSTM + GRU"],
      ["Model Version", predSummary.model_version || "N/A"],
      ["Prediction Reliability", predSummary.prediction_reliability || "N/A"],
      ["LSTM / GRU Comparison Ready", predSummary.comparison_ready ? "Yes" : "Partial"],
      ["Overall Ocean Health", riskAssessment.overall_ocean_health || "N/A"],
      ["Highest Risk Region", riskAssessment.highest_risk_region || "N/A"],
    ],
    ...TABLE_THEME,
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { cellWidth: 98 } },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (modelStats.length > 0) {
    y = drawHorizontalBars(
      doc,
      `${sectionNum}.1 Model Average Pollution`,
      modelStats.map((m: any) => ({
        label: formatModelLabel(m.model_type || m.model_label),
        value: Number(m.avg_pollution_level || 0),
        color: formatModelLabel(m.model_type || m.model_label) === "GRU" ? PDF.green : PDF.cyan,
        suffix: "",
      })),
      y,
      { maxRows: 4, maxValue: 100 }
    );

    y = ensureSpace(doc, y, 42);
    y = addSubSectionTitle(doc, `${sectionNum}.2 LSTM vs GRU Model Comparison`, y);

    autoTable(doc, {
      startY: y,
      head: [["Model", "Predictions", "Regions", "Avg", "Max", "Min", "Trend", "Risk", "CI Width"]],
      body: modelStats.map((m: any) => [
        formatModelLabel(m.model_type || m.model_label),
        String(m.total_predictions || 0),
        String(m.regions_analyzed || 0),
        Number(m.avg_pollution_level || 0).toFixed(1),
        Number(m.max_pollution_level || 0).toFixed(1),
        Number(m.min_pollution_level || 0).toFixed(1),
        m.trend || "N/A",
        m.risk_level || "N/A",
        Number(m.confidence_width || 0).toFixed(1),
      ]),
      ...TABLE_THEME,
      styles: { ...TABLE_THEME.styles, fontSize: 7.5, cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 } },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (regionalStats.length > 0) {
    y = drawHorizontalBars(
      doc,
      `${sectionNum}.${modelStats.length > 0 ? "3" : "2"} Regional Risk Ranking`,
      regionalStats.map((r: any) => ({
        label: r.region,
        value: Number(r.avg_pollution_level || 0),
        color: intensityColor(r.risk_level),
      })),
      y,
      { maxRows: 8, maxValue: 100 }
    );

    y = ensureSpace(doc, y, 48);
    y = addSubSectionTitle(doc, `${sectionNum}.${modelStats.length > 0 ? "4" : "3"} Regional Forecast Detail`, y);

    autoTable(doc, {
      startY: y,
      head: [["Region", "Models", "Avg Pollution", "Max", "Min", "Trend", "Risk Level", "Predictions"]],
      body: regionalStats.map((r: any) => [
        r.region,
        r.models_present || predSummary.models_included || "LSTM + GRU",
        Number(r.avg_pollution_level || 0).toFixed(1),
        Number(r.max_pollution_level || 0).toFixed(1),
        Number(r.min_pollution_level || 0).toFixed(1),
        r.trend || "N/A",
        r.risk_level || "N/A",
        String(r.total_predictions || 0),
      ]),
      ...TABLE_THEME,
      styles: { ...TABLE_THEME.styles, fontSize: 7.5, cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 } },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  const outlook = predAnalytics?.future_outlook;
  if (outlook) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = addSubSectionTitle(doc, `${sectionNum}.${modelStats.length > 0 ? "5" : "4"} Future Outlook`, y);

    autoTable(doc, {
      startY: y,
      head: [["Trend Category", "Regions"]],
      body: [
        ["Increasing Pollution", (outlook.increasing_trend_regions || []).join(", ") || "None"],
        ["Decreasing Pollution", (outlook.decreasing_trend_regions || []).join(", ") || "None"],
        ["Stable Pollution", (outlook.stable_regions || []).join(", ") || "None"],
        ["Critical Risk Regions", (riskAssessment.critical_regions || []).join(", ") || "None"],
      ],
      ...TABLE_THEME,
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  return y;
}

function buildGuidanceSection(
  doc: jsPDF,
  guidance: string[],
  sectionNum: number,
  startY: number
): number {
  const ph = doc.internal.pageSize.getHeight();
  let y = startY;

  if (!guidance.length) return y;
  if (y > 210) { doc.addPage(); y = 20; }

  y = addSectionTitle(doc, `${sectionNum}. Guidance`, y, "Operational Notes");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setRGB(doc, PDF.slate);
  setRGB(doc, PDF.softBlue, "fill");
  setRGB(doc, PDF.line, "draw");
  const panelY = y - 2;
  const panelH = Math.max(22, guidance.length * 12);
  doc.roundedRect(14, panelY, doc.internal.pageSize.getWidth() - 28, panelH, 2, 2, "FD");
  y += 6;

  guidance.forEach((item) => {
    setRGB(doc, PDF.teal, "fill");
    doc.circle(20, y - 1.5, 1.4, "F");
    const lines = doc.splitTextToSize(item, doc.internal.pageSize.getWidth() - 46);
    if (y + lines.length * 5 > ph - 28) { doc.addPage(); y = 20; }
    doc.text(lines, 26, y);
    y += lines.length * 5 + 3;
  });

  return y + 8;
}

function buildRecommendations(
  doc: jsPDF,
  recommendations: any[],
  sectionNum: number,
  startY: number
): number {
  const ph = doc.internal.pageSize.getHeight();
  let y = startY;

  y = addSectionTitle(doc, `${sectionNum}. Recommendations`, y, "Actions");

  autoTable(doc, {
    startY: y,
    head: [["Priority", "Category", "Recommendation"]],
    body: recommendations.map((r: any) => [
      r.priority || "Medium",
      r.category || "General",
      r.recommendation || "",
    ]),
    ...TABLE_THEME,
    columnStyles: { 2: { cellWidth: 100 } },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (y > 220) { doc.addPage(); y = 20; }
  y = addSubSectionTitle(doc, `${sectionNum}.1 Action Items`, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setRGB(doc, PDF.slate);
  recommendations.forEach((r: any) => {
    (r.action_items || []).forEach((item: string) => {
      if (y > ph - 30) { doc.addPage(); y = 20; }
      doc.text(`- [${r.priority}] ${item}`, 14, y);
      y += 5;
    });
  });

  return y + 8;
}

function buildPDF(reportTitle: string, reportData: any): jsPDF {
  // Fix 5: enforce standard document margins — Top: 20mm, Bottom: 25mm, Left/Right: 20mm
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // jsPDF's default left margin for autoTable is set via TABLE_THEME.margin (14mm ≈ 20mm visual with border)
  // We apply the explicit margin to the page origin offset for manually drawn content
  const pw = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const recommendations: any[] = reportData?.recommendations || [];
  const guidance: string[] = reportData?.ai_guidance || reportData?.guidance || [];
  const execSummary: string = reportData?.executive_summary || "";

  const rawType: string = reportData?.report_type || "detection";
  const isDetection = rawType === "detection";
  const isPrediction = rawType === "prediction";
  const isBoth = rawType === "both" || rawType === "custom";

  const subtitle = isDetection
    ? "YOLO Detection Report"
    : isPrediction
    ? "LSTM + GRU Prediction Report"
    : "Comprehensive Analysis Report";

  addHeader(doc, reportTitle, subtitle, today);

  let y = 65; // start content below the 50.5mm header + comfortable padding

  y = addSectionTitle(doc, "Executive Summary", y);

  const localAnalytics = getLocalAnalytics();
  const localHistory = getLocalHistory();
  const detStats = reportData?.detection_analytics?.summary || localAnalytics?.stats || {};
  const fallbackSummary = isDetection
    ? `Analysis of ${detStats.total_detections || 0} marine debris detections across ${detStats.total_files_processed || localHistory.length} sessions with ${Number(detStats.avg_confidence || 0).toFixed(1)}% average confidence.`
    : isPrediction
    ? "LSTM and GRU pollution forecasting analysis. Includes model comparison, trend analysis, risk assessment, and future outlook for marine pollution levels."
    : "Comprehensive marine environmental analysis combining YOLO debris detections with LSTM and GRU pollution predictions.";

  const summaryText = execSummary || fallbackSummary;
  y = ensureSpace(doc, y, 34);
  setRGB(doc, [251, 253, 254], "fill");
  setRGB(doc, PDF.line, "draw");
  const summaryLines = doc.splitTextToSize(summaryText, pw - 40);
  const summaryH = Math.max(24, summaryLines.length * 5 + 14);
  doc.roundedRect(14, y - 4, pw - 28, summaryH, 2, 2, "FD");
  setRGB(doc, PDF.teal, "fill");
  doc.rect(14, y - 4, 2.5, summaryH, "F");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  setRGB(doc, PDF.slate);
  doc.text(summaryLines, 22, y + 4);
  y += summaryH + 8;

  let sectionNum = 1;

  if (isDetection || isBoth) {
    y = buildYOLOSection(doc, reportData, sectionNum, y);
    sectionNum++;
  }

  if (isPrediction || isBoth) {
    y = buildPredictionSection(doc, reportData, sectionNum, y);
    sectionNum++;
  }

  if (guidance.length > 0) {
    y = buildGuidanceSection(doc, guidance, sectionNum, y);
    sectionNum++;
  }

  if (recommendations.length > 0) {
    y = buildRecommendations(doc, recommendations, sectionNum, y);
  }

  addFooters(doc, today);

  return doc;
}

export async function viewPDFReport(reportTitle: string, reportId?: string | number): Promise<void> {
  const reportData = await _fetchReportData(reportId);
  await enrichReportGuidance(reportData);
  const doc = buildPDF(reportTitle, reportData);
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
}

export async function downloadPDFReport(reportTitle: string, reportId?: string | number): Promise<void> {
  const reportData = await _fetchReportData(reportId);
  await enrichReportGuidance(reportData);
  const doc = buildPDF(reportTitle, reportData);
  const fileName = reportTitle.replace(/\s+/g, "_").toLowerCase() + ".pdf";
  doc.save(fileName);
}

async function enrichReportGuidance(reportData: any): Promise<void> {
  if (!reportData) return;
  if (Array.isArray(reportData.ai_guidance) && reportData.ai_guidance.length > 0) return;

  const aiGuidance = await generateAIGuidance(reportData);
  reportData.ai_guidance = aiGuidance || buildFallbackGuidance(reportData);
  reportData.guidance_source = aiGuidance ? "gemini" : "fallback";
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
    const meta = json?.report?.metadata;
    if (meta?.data) return meta.data;
    return meta || null;
  } catch {
    return null;
  }
}
