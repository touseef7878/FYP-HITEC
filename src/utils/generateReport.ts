import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Get real data from localStorage or return empty defaults
function getDetectionStats() {
  try {
    const analyticsData = localStorage.getItem('analyticsData');
    if (analyticsData) {
      const data = JSON.parse(analyticsData);
      return data.stats || {
        totalDetections: 0,
        avgConfidence: 0,
        thisWeek: 0,
        detectionRate: 0,
      };
    }
  } catch (error) {
    console.error('Error loading analytics data:', error);
  }
  
  return {
    totalDetections: 0,
    avgConfidence: 0,
    thisWeek: 0,
    detectionRate: 0,
  };
}

function getClassDistribution() {
  try {
    const analyticsData = localStorage.getItem('analyticsData');
    if (analyticsData) {
      const data = JSON.parse(analyticsData);
      return data.classDistribution || [];
    }
  } catch (error) {
    console.error('Error loading class distribution:', error);
  }
  
  return [];
}

function getWeeklyTrend() {
  try {
    const analyticsData = localStorage.getItem('analyticsData');
    if (analyticsData) {
      const data = JSON.parse(analyticsData);
      return data.trendData || [];
    }
  } catch (error) {
    console.error('Error loading trend data:', error);
  }
  
  return [];
}

function getDetectionHistory() {
  try {
    const history = localStorage.getItem('detectionHistory');
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error loading detection history:', error);
    return [];
  }
}

function getPollutionHotspots() {
  try {
    const hotspots = localStorage.getItem('pollutionHotspots');
    return hotspots ? JSON.parse(hotspots) : [];
  } catch (error) {
    console.error('Error loading hotspots:', error);
    return [];
  }
}

// Get LSTM prediction data (mock for now - would come from PredictionsPage)
function getLSTMPredictions() {
  try {
    const predictions = localStorage.getItem('lstmPredictions');
    if (predictions) {
      return JSON.parse(predictions);
    }
  } catch (error) {
    console.error('Error loading LSTM predictions:', error);
  }
  
  // Return mock LSTM data structure
  return {
    regions: [
      {
        name: "Pacific Ocean",
        currentLevel: 65.2,
        predictedLevel: 72.8,
        trendChange: 11.6,
        riskLevel: "High",
        confidence: 87.3,
        predictions: [
          { date: "2024-02-01", level: 65.2, confidence: 89 },
          { date: "2024-02-15", level: 68.1, confidence: 86 },
          { date: "2024-03-01", level: 70.5, confidence: 84 },
          { date: "2024-03-15", level: 72.8, confidence: 82 }
        ]
      },
      {
        name: "Atlantic Ocean",
        currentLevel: 42.7,
        predictedLevel: 45.3,
        trendChange: 6.1,
        riskLevel: "Moderate",
        confidence: 91.2,
        predictions: [
          { date: "2024-02-01", level: 42.7, confidence: 92 },
          { date: "2024-02-15", level: 43.8, confidence: 91 },
          { date: "2024-03-01", level: 44.6, confidence: 90 },
          { date: "2024-03-15", level: 45.3, confidence: 89 }
        ]
      }
    ],
    modelInfo: {
      version: "v2.1.0",
      accuracy: 89.4,
      trainingData: "2 years",
      lastTrained: "2024-01-15"
    }
  };
}

function createPDFDocument(reportName: string): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const detectionStats = getDetectionStats();
  const classDistribution = getClassDistribution();
  const weeklyTrend = getWeeklyTrend();
  const detectionHistory = getDetectionHistory();
  const hotspots = getPollutionHotspots();
  const lstmData = getLSTMPredictions();

  let yPos = 20;

  // ===== HEADER =====
  doc.setFillColor(20, 78, 106);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("MARINE PLASTIC DETECTION", 14, 25);
  
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Comprehensive Analysis Report", 14, 35);
  
  doc.setFontSize(10);
  doc.text(currentDate, pageWidth - 14, 20, { align: "right" });
  doc.text(reportName, pageWidth - 14, 30, { align: "right" });
  doc.text("OceanGuard AI Platform", pageWidth - 14, 40, { align: "right" });

  yPos = 65;

  // ===== EXECUTIVE SUMMARY =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 78, 106);
  doc.text("EXECUTIVE SUMMARY", 14, yPos);
  
  yPos += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  
  const summaryText = detectionStats.totalDetections === 0 
    ? "This report presents the current state of marine plastic detection analysis. No detection data is currently available. The system is ready to process images and videos for plastic waste identification and environmental impact assessment."
    : `This comprehensive report analyzes marine plastic pollution through AI-powered detection and predictive modeling. Our analysis covers ${detectionStats.totalDetections.toLocaleString()} detected objects across ${detectionHistory.length} detection sessions, with an average confidence of ${detectionStats.avgConfidence.toFixed(1)}%. The report includes both real-time detection results and LSTM-based pollution forecasting for strategic environmental planning.`;

  const splitText = doc.splitTextToSize(summaryText, pageWidth - 28);
  doc.text(splitText, 14, yPos);
  yPos += splitText.length * 5 + 10;

  // ===== DETECTION ANALYSIS SECTION =====
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 78, 106);
  doc.text("1. DETECTION ANALYSIS", 14, yPos);
  yPos += 10;

  // Key Statistics
  doc.setFontSize(14);
  doc.text("1.1 Key Performance Metrics", 14, yPos);
  yPos += 8;

  const statsData = [
    ["Total Objects Detected", detectionStats.totalDetections.toLocaleString()],
    ["Average Detection Confidence", `${detectionStats.avgConfidence.toFixed(1)}%`],
    ["Detections This Week", detectionStats.thisWeek.toString()],
    ["System Detection Rate", `${detectionStats.detectionRate.toFixed(1)}%`],
    ["Total Detection Sessions", detectionHistory.length.toString()],
    ["Active Pollution Hotspots", hotspots.length.toString()]
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: statsData,
    theme: "striped",
    headStyles: { 
      fillColor: [20, 78, 106],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Class Distribution Analysis
  if (classDistribution.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 78, 106);
    doc.text("1.2 Plastic Waste Classification", 14, yPos);
    yPos += 8;

    const classData = classDistribution.map((item) => [
      item.name,
      item.value.toString(),
      `${((item.value / detectionStats.totalDetections) * 100).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Plastic Type", "Count", "Percentage"]],
      body: classData,
      theme: "striped",
      headStyles: { 
        fillColor: [20, 78, 106],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Visual Distribution Chart
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text("1.3 Distribution Visualization", 14, yPos);
    yPos += 10;

    const maxCount = Math.max(...classDistribution.map((c) => c.value || 0));
    const barHeight = 12;
    const maxBarWidth = 120;

    classDistribution.forEach((item, index) => {
      const barWidth = maxCount > 0 ? ((item.value || 0) / maxCount) * maxBarWidth : 0;
      
      // Bar background
      doc.setFillColor(240, 240, 240);
      doc.rect(70, yPos + index * 16, maxBarWidth, barHeight, "F");
      
      // Bar
      doc.setFillColor(46, 160, 134);
      doc.rect(70, yPos + index * 16, barWidth, barHeight, "F");
      
      // Label
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(item.name, 14, yPos + index * 16 + 8);
      
      // Value
      doc.text((item.value || 0).toString(), 72 + barWidth + 3, yPos + index * 16 + 8);
    });

    yPos += classDistribution.length * 16 + 15;
  }

  // ===== LSTM PREDICTIONS SECTION =====
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 78, 106);
  doc.text("2. PREDICTIVE ANALYSIS (LSTM)", 14, yPos);
  yPos += 10;

  // Model Information
  doc.setFontSize(14);
  doc.text("2.1 Model Performance", 14, yPos);
  yPos += 8;

  const modelData = [
    ["Model Version", lstmData.modelInfo.version],
    ["Prediction Accuracy", `${lstmData.modelInfo.accuracy}%`],
    ["Training Dataset", lstmData.modelInfo.trainingData],
    ["Last Model Update", lstmData.modelInfo.lastTrained],
    ["Regions Analyzed", lstmData.regions.length.toString()],
    ["Forecast Horizon", "90 days"]
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Model Attribute", "Value"]],
    body: modelData,
    theme: "striped",
    headStyles: { 
      fillColor: [20, 78, 106],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Regional Predictions
  doc.setFontSize(14);
  doc.text("2.2 Regional Pollution Forecasts", 14, yPos);
  yPos += 8;

  const regionData = lstmData.regions.map((region) => [
    region.name,
    region.currentLevel.toFixed(1),
    region.predictedLevel.toFixed(1),
    `${region.trendChange > 0 ? '+' : ''}${region.trendChange.toFixed(1)}%`,
    region.riskLevel,
    `${region.confidence.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Region", "Current Level", "Predicted Level", "Trend Change", "Risk Level", "Confidence"]],
    body: regionData,
    theme: "striped",
    headStyles: { 
      fillColor: [20, 78, 106],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ===== RECOMMENDATIONS SECTION =====
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 78, 106);
  doc.text("3. RECOMMENDATIONS & IMPROVEMENTS", 14, yPos);
  yPos += 10;

  // Detection System Improvements
  doc.setFontSize(14);
  doc.text("3.1 Detection System Enhancements", 14, yPos);
  yPos += 8;

  const detectionRecommendations = [
    "• Increase detection frequency in high-pollution zones identified",
    "• Implement real-time monitoring for critical pollution hotspots",
    "• Expand training dataset with region-specific plastic waste types",
    "• Deploy automated detection systems in identified high-risk areas",
    "• Integrate satellite imagery for large-scale pollution monitoring"
  ];

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  detectionRecommendations.forEach((rec, index) => {
    doc.text(rec, 14, yPos + index * 6);
  });
  yPos += detectionRecommendations.length * 6 + 10;

  // LSTM Model Improvements
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 78, 106);
  doc.text("3.2 Predictive Model Enhancements", 14, yPos);
  yPos += 8;

  const lstmRecommendations = [
    "• Incorporate additional environmental variables (ocean currents, weather)",
    "• Extend prediction horizon to 6-12 months for better planning",
    "• Implement ensemble models for improved accuracy",
    "• Add seasonal variation analysis for better trend prediction",
    "• Integrate real-time oceanographic data feeds"
  ];

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  lstmRecommendations.forEach((rec, index) => {
    doc.text(rec, 14, yPos + index * 6);
  });
  yPos += lstmRecommendations.length * 6 + 10;

  // Action Items
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 78, 106);
  doc.text("3.3 Immediate Action Items", 14, yPos);
  yPos += 8;

  const actionItems = [
    "• Deploy monitoring equipment in newly identified hotspots",
    "• Collaborate with local authorities for cleanup initiatives",
    "• Establish regular monitoring schedule for high-risk zones",
    "• Develop early warning system based on LSTM predictions",
    "• Create public awareness campaigns for identified pollution areas"
  ];

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  actionItems.forEach((item, index) => {
    doc.text(item, 14, yPos + index * 6);
  });
  yPos += actionItems.length * 6 + 15;

  // ===== FOOTER =====
  const footerY = pageHeight - 25;
  doc.setFillColor(20, 78, 106);
  doc.rect(0, footerY, pageWidth, 25, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(
    "Generated by OceanGuard AI - Marine Plastic Detection Platform",
    14,
    footerY + 10
  );
  doc.text(
    `Report ID: ${Date.now()} | ${currentDate}`,
    pageWidth - 14,
    footerY + 10,
    { align: "right" }
  );
  doc.text(
    "Confidential - For Environmental Research Use Only",
    14,
    footerY + 18
  );
  doc.text(
    `Page 1 of 1`,
    pageWidth - 14,
    footerY + 18,
    { align: "right" }
  );

  return doc;
}

// Generate PDF and return blob URL for viewing
export function generatePDFBlob(reportName: string): string {
  const doc = createPDFDocument(reportName);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

// Download PDF directly
export function downloadPDFReport(reportName: string): void {
  const doc = createPDFDocument(reportName);
  const fileName = reportName.replace(/\s+/g, "_").toLowerCase() + ".pdf";
  doc.save(fileName);
}

// View PDF in new tab
export function viewPDFReport(reportName: string): void {
  const blobUrl = generatePDFBlob(reportName);
  window.open(blobUrl, "_blank");
}
