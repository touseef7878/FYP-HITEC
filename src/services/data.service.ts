/**
 * Data Service — OceanGuard AI
 *
 * All methods now fetch FRESH data directly from the backend API.
 * localStorage is used only as a write-through cache for offline resilience,
 * NOT as the primary data source (that was the root cause of stale UI).
 *
 * React Query handles caching, deduplication, and background refetching.
 * This service is the queryFn — it always hits the network.
 */

import ENV from '@/config/env';

const API_URL = ENV.API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  success: boolean;
  filename: string;
  totalDetections: number;
  detection_id?: number;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number };
    frame?: number;
    timestamp?: number;
  }>;
  summary: Array<{
    class: string;
    count: number;
    avgConfidence: number;
    framesAppeared?: number;
    appearanceRate?: number;
  }>;
  avgConfidence?: number;
  annotatedImage?: string;
  originalImage?: string;
  annotatedVideo?: string;
  originalVideo?: string;
  annotatedVideoUrl?: string;
  originalVideoUrl?: string;
  totalFrames?: number;
  processedFrames?: number;
  framesWithDetections?: number;
  detectionRate?: number;
  avgDetectionsPerFrame?: number;
  fps?: number;
  duration?: number;
  resolution?: string;
  fileSizeMB?: number;
  videoId?: string;
  result_id?: string;
  processingStats?: {
    uniqueClasses: number;
    detectionRate: number;
    avgDetectionsPerFrame: number;
    framesWithDetections: number;
  };
}

export interface HistoryItem {
  id: string;
  detectionId?: number;
  filename: string;
  type: 'image' | 'video';
  date: string;
  time: string;
  objects: number;
  confidence: number;
  classes: string[];
  result: DetectionResult;
  upload_date?: string;
  file_type?: string;
  total_detections?: number;
  avg_confidence?: number;
}

export interface AnalyticsData {
  stats: {
    totalDetections: number;
    avgConfidence: number;
    thisWeek: number;
    detectionRate: number;
  };
  trendData: Array<{ date: string; detections: number; confidence: number }>;
  classDistribution: Array<{ name: string; value: number; color: string }>;
  objectCounts: Array<{ class: string; count: number }>;
}

export interface Hotspot {
  name: string;
  location: string;
  coordinates: string;
  intensity: 'Critical' | 'High' | 'Moderate' | 'Low';
  plasticDensity: string;
  color: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

const CLASS_COLORS = [
  'hsl(207, 90%, 30%)',
  'hsl(172, 60%, 38%)',
  'hsl(185, 65%, 42%)',
  'hsl(158, 80%, 36%)',
  'hsl(38, 95%, 48%)',
  'hsl(25, 95%, 53%)',
  'hsl(271, 81%, 56%)',
  'hsl(348, 83%, 47%)',
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
];

// ── DataService ───────────────────────────────────────────────────────────────

class DataService {
  private static instance: DataService;

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  // ── mapHistoryItem ──────────────────────────────────────────────────────────

  private mapHistoryItem(item: any): HistoryItem {
    let parsedResult: any = {};
    try {
      parsedResult = item.raw_result ? JSON.parse(item.raw_result) : {};
    } catch {
      parsedResult = {};
    }

    const result: DetectionResult = {
      ...parsedResult,
      filename: item.filename,
      totalDetections: item.total_detections || 0,
      detections: parsedResult.detections || [],
      summary: parsedResult.summary || [],
      annotatedVideoUrl: parsedResult.annotatedVideoUrl || item.annotated_video_url,
      videoId: parsedResult.videoId || item.video_id,
      totalFrames: parsedResult.totalFrames || item.total_frames,
      processedFrames: parsedResult.processedFrames,
      framesWithDetections: parsedResult.framesWithDetections,
      detectionRate: parsedResult.detectionRate,
      avgDetectionsPerFrame: parsedResult.avgDetectionsPerFrame,
      fps: parsedResult.fps,
      duration: parsedResult.duration,
      resolution: parsedResult.resolution,
      fileSizeMB: parsedResult.fileSizeMB,
      success: true,
    };

    return {
      id: item.id.toString(),
      detectionId: item.id,
      filename: item.filename,
      type: item.file_type as 'image' | 'video',
      date: new Date(item.upload_date).toISOString().split('T')[0],
      time: new Date(item.upload_date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      objects: item.total_detections || 0,
      confidence: Math.round(item.avg_confidence || 0),
      classes: item.classes || [],
      result,
      upload_date: item.upload_date,
      file_type: item.file_type,
      total_detections: item.total_detections,
      avg_confidence: item.avg_confidence,
    };
  }

  // ── getHistory — ALWAYS fetches fresh from API ──────────────────────────────

  async getHistory(): Promise<HistoryItem[]> {
    const token = getToken();
    if (!token) return this.getLocalHistory();

    try {
      const response = await fetch(`${API_URL}/api/history?limit=100`, {
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success) throw new Error('API returned success=false');

      const freshHistory: HistoryItem[] = data.history.map((item: any) =>
        this.mapHistoryItem(item)
      );

      // Write-through cache for offline resilience
      try {
        localStorage.setItem('detectionHistory', JSON.stringify(freshHistory.slice(0, 50)));
      } catch { /* storage quota */ }

      return freshHistory;
    } catch (error) {
      console.warn('[DataService] getHistory API failed, using cache:', error);
      return this.getLocalHistory();
    }
  }

  // ── getAnalytics — ALWAYS fetches fresh from API ────────────────────────────

  async getAnalytics(): Promise<AnalyticsData> {
    const token = getToken();
    if (!token) return this.emptyAnalytics();

    try {
      const response = await fetch(`${API_URL}/api/analytics?days=30`, {
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success || !data.analytics) throw new Error('Invalid analytics response');

      const analytics: AnalyticsData = data.analytics;

      // Write-through cache
      try {
        localStorage.setItem('analyticsData', JSON.stringify(analytics));
      } catch { /* storage quota */ }

      return analytics;
    } catch (error) {
      console.warn('[DataService] getAnalytics API failed, using cache:', error);
      return this.getLocalAnalytics();
    }
  }

  // ── saveDetectionResult — called after upload completes ────────────────────

  async saveDetectionResult(result: DetectionResult): Promise<void> {
    // Backend already saved it during the POST /detect call.
    // We just update the local write-through cache for immediate display.
    this.addToLocalHistory(result);
  }

  // ── clearAllData ────────────────────────────────────────────────────────────

  async clearAllData(): Promise<void> {
    localStorage.removeItem('detectionHistory');
    localStorage.removeItem('analyticsData');
    localStorage.removeItem('pollutionHotspots');
    localStorage.removeItem('generatedReports');
    sessionStorage.removeItem('detectionResults');
  }

  // ── getHotspots — kept for legacy compatibility ─────────────────────────────

  getHotspots(): Hotspot[] {
    try {
      const h = localStorage.getItem('pollutionHotspots');
      return h ? JSON.parse(h) : [];
    } catch {
      return [];
    }
  }

  // ── exportData ──────────────────────────────────────────────────────────────

  async exportData(): Promise<string> {
    const history = await this.getHistory();
    const analytics = await this.getAnalytics();
    return JSON.stringify(
      { history, analytics, hotspots: this.getHotspots(), exportDate: new Date().toISOString() },
      null,
      2
    );
  }

  // ── importData ──────────────────────────────────────────────────────────────

  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.history) localStorage.setItem('detectionHistory', JSON.stringify(data.history));
      if (data.analytics) localStorage.setItem('analyticsData', JSON.stringify(data.analytics));
      if (data.hotspots) localStorage.setItem('pollutionHotspots', JSON.stringify(data.hotspots));
      return true;
    } catch {
      return false;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private addToLocalHistory(result: DetectionResult): void {
    const history = this.getLocalHistory();
    const now = new Date();

    const item: HistoryItem = {
      id: result.result_id || `det_${Date.now()}`,
      detectionId: result.result_id ? parseInt(result.result_id) : undefined,
      filename: result.filename,
      type:
        result.annotatedVideo || result.originalVideo || result.totalFrames
          ? 'video'
          : 'image',
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      objects: result.totalDetections,
      confidence:
        result.summary.length > 0
          ? Math.round(
              result.summary.reduce((s, i) => s + i.avgConfidence, 0) / result.summary.length
            )
          : 0,
      classes: result.summary.map((i) => i.class),
      result,
    };

    history.unshift(item);
    if (history.length > 50) history.splice(50);

    try {
      localStorage.setItem('detectionHistory', JSON.stringify(history));
    } catch { /* storage quota */ }
  }

  private getLocalHistory(): HistoryItem[] {
    try {
      const h = localStorage.getItem('detectionHistory');
      return h ? JSON.parse(h) : [];
    } catch {
      return [];
    }
  }

  private getLocalAnalytics(): AnalyticsData {
    try {
      const a = localStorage.getItem('analyticsData');
      return a ? JSON.parse(a) : this.emptyAnalytics();
    } catch {
      return this.emptyAnalytics();
    }
  }

  private emptyAnalytics(): AnalyticsData {
    return {
      stats: { totalDetections: 0, avgConfidence: 0, thisWeek: 0, detectionRate: 0 },
      trendData: [],
      classDistribution: [],
      objectCounts: [],
    };
  }
}

export const dataService = DataService.getInstance();
