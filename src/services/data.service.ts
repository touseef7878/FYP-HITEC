/**
 * Data Service for Marine Plastic Detection Platform
 * Handles data persistence, analytics aggregation, and cross-page data flow
 * Now integrated with SQLite database backend
 */

import ENV from '@/config/env';

// Backend API URL
const API_URL = ENV.API_URL;

export interface DetectionResult {
  success: boolean;
  filename: string;
  totalDetections: number;
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
  result_id?: string; // Database ID
  processingStats?: {
    uniqueClasses: number;
    detectionRate: number;
    avgDetectionsPerFrame: number;
    framesWithDetections: number;
  };
}

export interface HistoryItem {
  id: string;
  detectionId?: number; // Database ID for deletion
  filename: string;
  type: "image" | "video";
  date: string;
  time: string;
  objects: number;
  confidence: number;
  classes: string[];
  result: DetectionResult; // Store full result for viewing
  upload_date?: string; // Database timestamp
  file_type?: string; // Database field
  total_detections?: number; // Database field
  avg_confidence?: number; // Database field
}

export interface AnalyticsData {
  stats: {
    totalDetections: number;
    avgConfidence: number;
    thisWeek: number;
    detectionRate: number;
  };
  trendData: Array<{
    date: string;
    detections: number;
    confidence: number;
  }>;
  classDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  objectCounts: Array<{
    class: string;
    count: number;
  }>;
}

export interface Hotspot {
  name: string;
  location: string;
  coordinates: string;
  intensity: "Critical" | "High" | "Moderate" | "Low";
  plasticDensity: string;
  color: string;
}

// Color palette for class distribution
const CLASS_COLORS = [
  "hsl(203, 77%, 26%)", // Blue
  "hsl(170, 50%, 45%)", // Teal
  "hsl(177, 59%, 41%)", // Cyan
  "hsl(160, 84%, 39%)", // Green
  "hsl(38, 92%, 50%)",  // Orange
  "hsl(25, 95%, 53%)",  // Red-orange
  "hsl(271, 81%, 56%)", // Purple
  "hsl(348, 83%, 47%)", // Pink
  "hsl(221, 83%, 53%)", // Indigo
  "hsl(142, 71%, 45%)", // Emerald
];

class DataService {
  private static instance: DataService;
  private useDatabase: boolean = true;
  private abortControllers: Map<string, AbortController> = new Map();

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }
  
  private cancelRequest(key: string): void {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }
  
  private createAbortController(key: string): AbortController {
    this.cancelRequest(key);
    const controller = new AbortController();
    this.abortControllers.set(key, controller);
    return controller;
  }

  /** Map a raw DB history item to HistoryItem — single source of truth */
  private mapHistoryItem(item: any): HistoryItem {
    let parsedResult: any = {};
    try {
      parsedResult = item.raw_result ? JSON.parse(item.raw_result) : {};
    } catch { parsedResult = {}; }

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
      type: item.file_type as "image" | "video",
      date: new Date(item.upload_date).toISOString().split('T')[0],
      time: new Date(item.upload_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
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

  /**
   * Save detection result and update all related data
   * Now saves to database if available, falls back to localStorage
   */
  async saveDetectionResult(result: DetectionResult): Promise<void> {
    try {
      if (this.useDatabase) {
        // Database is already handling the save in the backend
        // Just update local storage for immediate UI updates
        this.addToLocalHistory(result);
        console.log('Detection result saved to database and local storage');
      } else {
        // Fallback to localStorage only
        this.addToHistory(result);
        this.updateAnalytics(result);
        this.updateHotspots(result);
        console.log('Detection result saved to localStorage only');
      }
    } catch (error) {
      console.error('Error saving detection result:', error);
      // Fallback to localStorage
      this.addToHistory(result);
      this.updateAnalytics(result);
      this.updateHotspots(result);
    }
  }

  /**
   * Get detection history from database or localStorage
   * Uses timeout to prevent blocking and returns cached data immediately
   * OPTIMIZED: Added request cancellation
   */
  async getHistory(): Promise<HistoryItem[]> {
    // Return cached data immediately for instant UI
    const cachedHistory = this.getLocalHistory();
    
    // Fetch fresh data in background without blocking
    if (this.useDatabase) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // OPTIMIZED: Create abort controller for cancellation
        const controller = this.createAbortController('history');
        
        // Fire and forget - don't wait for response
        fetch(`${API_URL}/api/history?limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }).then(async response => {
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const freshHistory = data.history.map((item: any) => this.mapHistoryItem(item));
              localStorage.setItem('detectionHistory', JSON.stringify(freshHistory.slice(0, 50)));
            }
          }
        }).catch(() => {
          // Silently fail - we already have cached data
        });
      }
    }
    
    // Return cached data immediately
    return cachedHistory;
  }

  /**
   * Get detection history with fresh data (blocking) - use only when needed
   * OPTIMIZED: Added request cancellation and timeout
   */
  async getHistoryFresh(): Promise<HistoryItem[]> {
    try {
      if (this.useDatabase) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          // OPTIMIZED: Add timeout and cancellation
          const controller = this.createAbortController('history-fresh');
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch(`${API_URL}/api/history?limit=100`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const freshHistory = data.history.map((item: any) => this.mapHistoryItem(item));
              localStorage.setItem('detectionHistory', JSON.stringify(freshHistory.slice(0, 50)));
              return freshHistory;
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('History fetch timed out, using cached data');
      } else {
        console.error('Error fetching history from database:', error);
      }
    }
    
    // Return cached data if fetch failed or timed out
    return this.getLocalHistory();
  }

  /**
   * Get analytics data from database or localStorage with enhanced error handling
   * Returns cached data immediately, fetches fresh data in background
   */
  async getAnalytics(): Promise<AnalyticsData> {
    // Return cached data immediately for instant UI
    const cachedAnalytics = this.getLocalAnalytics();
    
    // Fetch fresh data in background without blocking
    if (this.useDatabase) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Fire and forget - don't wait for response
        fetch(`${API_URL}/api/analytics?days=30`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }).then(async response => {
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.analytics) {
              localStorage.setItem('analyticsData', JSON.stringify(data.analytics));
            }
          }
        }).catch(() => {
          // Silently fail - we already have cached data
        });
      }
    }
    
    // Return cached analytics immediately
    if (!cachedAnalytics || cachedAnalytics.stats.totalDetections === 0) {
      return {
        stats: {
          totalDetections: 0,
          avgConfidence: 0,
          thisWeek: 0,
          detectionRate: 0,
        },
        trendData: [],
        classDistribution: [],
        objectCounts: [],
      };
    }
    
    return cachedAnalytics;
  }

  /**
   * Trigger analytics generation after a detection
   * Fire and forget - don't wait for response
   * Debounced to prevent excessive API calls
   */
  private lastGenerateTime: number = 0;
  private generateDebounceMs: number = 5000; // 5 seconds

  async generateAnalytics(): Promise<void> {
    const now = Date.now();
    if (now - this.lastGenerateTime < this.generateDebounceMs) {
      console.log('Analytics generation debounced');
      return; // Skip if called too recently
    }
    
    this.lastGenerateTime = now;
    
    if (this.useDatabase) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Fire and forget - don't wait
        fetch(`${API_URL}/api/analytics/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }).then(async response => {
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.analytics) {
              localStorage.setItem('analyticsData', JSON.stringify(data.analytics));
            }
          }
        }).catch(() => {
          // Silently fail
        });
      }
    }
  }

  /**
   * Clear all data (database and localStorage)
   */
  async clearAllData(): Promise<void> {
    try {
      if (this.useDatabase) {
        const response = await fetch(`${API_URL}/api/database/clear`, {
          method: 'DELETE'
        });
        if (response.ok) {
          console.log('Database cleared successfully');
        }
      }
    } catch (error) {
      console.error('Error clearing database:', error);
    }
    
    // Also clear localStorage
    this.clearLocalData();
  }

  // ============================================================================
  // LOCAL STORAGE METHODS (Fallback and immediate UI updates)
  // ============================================================================

  private addToLocalHistory(result: DetectionResult): void {
    const history = this.getLocalHistory();
    const now = new Date();
    
    const historyItem: HistoryItem = {
      id: result.result_id || `det_${Date.now()}`,
      detectionId: result.result_id ? parseInt(result.result_id) : undefined, // Add detectionId for deletion
      filename: result.filename,
      type: result.annotatedVideo || result.originalVideo || result.totalFrames ? "video" : "image",
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      objects: result.totalDetections,
      confidence: result.summary.length > 0 
        ? result.summary.reduce((sum, item) => sum + item.avgConfidence, 0) / result.summary.length 
        : 0,
      classes: result.summary.map(item => item.class),
      result: result
    };

    history.unshift(historyItem);
    
    // Keep only last 50 items in localStorage (database has more)
    if (history.length > 50) {
      history.splice(50);
    }

    localStorage.setItem('detectionHistory', JSON.stringify(history));
  }

  private getLocalHistory(): HistoryItem[] {
    try {
      const history = localStorage.getItem('detectionHistory');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error loading local history:', error);
      return [];
    }
  }

  private getLocalAnalytics(): AnalyticsData {
    try {
      const analytics = localStorage.getItem('analyticsData');
      return analytics ? JSON.parse(analytics) : {
        stats: {
          totalDetections: 0,
          avgConfidence: 0,
          thisWeek: 0,
          detectionRate: 0,
        },
        trendData: [],
        classDistribution: [],
        objectCounts: [],
      };
    } catch (error) {
      console.error('Error loading local analytics:', error);
      return {
        stats: {
          totalDetections: 0,
          avgConfidence: 0,
          thisWeek: 0,
          detectionRate: 0,
        },
        trendData: [],
        classDistribution: [],
        objectCounts: [],
      };
    }
  }

  private clearLocalData(): void {
    localStorage.removeItem('detectionHistory');
    localStorage.removeItem('analyticsData');
    localStorage.removeItem('pollutionHotspots');
    localStorage.removeItem('generatedReports');
    sessionStorage.removeItem('detectionResults');
  }

  /**
   * Add detection result to history (legacy method for localStorage)
   */
  private addToHistory(result: DetectionResult): void {
    const history = this.getLocalHistory();
    const now = new Date();
    
    const historyItem: HistoryItem = {
      id: `det_${Date.now()}`,
      detectionId: result.result_id ? parseInt(result.result_id) : undefined, // Add detectionId for deletion
      filename: result.filename,
      type: result.annotatedVideo || result.originalVideo ? "video" : "image",
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      objects: result.totalDetections,
      confidence: result.summary.length > 0 
        ? result.summary.reduce((sum, item) => sum + item.avgConfidence, 0) / result.summary.length 
        : 0,
      classes: result.summary.map(item => item.class),
      result: result
    };

    history.unshift(historyItem); // Add to beginning
    
    // Keep only last 100 items
    if (history.length > 100) {
      history.splice(100);
    }

    localStorage.setItem('detectionHistory', JSON.stringify(history));
  }

  /**
   * Update analytics data with new detection result (legacy method for localStorage)
   */
  private updateAnalytics(result: DetectionResult): void {
    const analytics = this.getLocalAnalytics();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Update stats
    analytics.stats.totalDetections += result.totalDetections;
    
    // Calculate average confidence
    const totalConfidence = analytics.stats.avgConfidence * (analytics.stats.totalDetections - result.totalDetections);
    const newConfidence = result.summary.length > 0 
      ? result.summary.reduce((sum, item) => sum + item.avgConfidence, 0) / result.summary.length 
      : 0;
    analytics.stats.avgConfidence = (totalConfidence + newConfidence) / analytics.stats.totalDetections;

    // Update this week count
    const history = this.getLocalHistory();
    analytics.stats.thisWeek = history.filter(item => 
      new Date(item.date) >= weekAgo
    ).reduce((sum, item) => sum + item.objects, 0);

    // Update detection rate (assuming 100% for now)
    analytics.stats.detectionRate = 100;

    // Update trend data
    const existingTrendIndex = analytics.trendData.findIndex(item => item.date === today);
    if (existingTrendIndex >= 0) {
      analytics.trendData[existingTrendIndex].detections += result.totalDetections;
      analytics.trendData[existingTrendIndex].confidence = 
        (analytics.trendData[existingTrendIndex].confidence + newConfidence) / 2;
    } else {
      analytics.trendData.push({
        date: today,
        detections: result.totalDetections,
        confidence: newConfidence
      });
    }

    // Keep only last 30 days of trend data
    analytics.trendData = analytics.trendData
      .filter(item => new Date(item.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Update class distribution
    result.summary.forEach(summaryItem => {
      const existingClass = analytics.classDistribution.find(item => item.name === summaryItem.class);
      if (existingClass) {
        existingClass.value += summaryItem.count;
      } else {
        analytics.classDistribution.push({
          name: summaryItem.class,
          value: summaryItem.count,
          color: CLASS_COLORS[analytics.classDistribution.length % CLASS_COLORS.length]
        });
      }
    });

    // Update object counts
    result.summary.forEach(summaryItem => {
      const existingCount = analytics.objectCounts.find(item => item.class === summaryItem.class);
      if (existingCount) {
        existingCount.count += summaryItem.count;
      } else {
        analytics.objectCounts.push({
          class: summaryItem.class,
          count: summaryItem.count
        });
      }
    });

    // Sort object counts by count descending
    analytics.objectCounts.sort((a, b) => b.count - a.count);

    localStorage.setItem('analyticsData', JSON.stringify(analytics));
  }

  /**
   * Update hotspots based on detection patterns
   */
  private updateHotspots(result: DetectionResult): void {
    // This is a simplified implementation
    // In a real app, you'd correlate with GPS data or user-provided location
    const hotspots = this.getHotspots();
    
    // For now, we'll create synthetic hotspots based on detection intensity
    if (result.totalDetections > 20) {
      const intensity = result.totalDetections > 50 ? "Critical" : 
                      result.totalDetections > 30 ? "High" : "Moderate";
      
      const newHotspot: Hotspot = {
        name: `Detection Zone ${Date.now()}`,
        location: "Marine Region",
        coordinates: "Unknown",
        intensity: intensity as any,
        plasticDensity: `${Math.round(result.totalDetections * 1.5)}K pieces/km²`,
        color: intensity === "Critical" ? "bg-destructive" : 
               intensity === "High" ? "bg-warning" : "bg-chart-5"
      };

      hotspots.unshift(newHotspot);
      
      // Keep only last 10 hotspots
      if (hotspots.length > 10) {
        hotspots.splice(10);
      }

      localStorage.setItem('pollutionHotspots', JSON.stringify(hotspots));
    }
  }

  /**
   * Get pollution hotspots
   */
  getHotspots(): Hotspot[] {
    try {
      const hotspots = localStorage.getItem('pollutionHotspots');
      return hotspots ? JSON.parse(hotspots) : [];
    } catch (error) {
      console.error('Error loading hotspots:', error);
      return [];
    }
  }

  /**
   * Export all data
   */
  async exportData(): Promise<string> {
    const history = await this.getHistory();
    const analytics = await this.getAnalytics();
    
    return JSON.stringify({
      history,
      analytics,
      hotspots: this.getHotspots(),
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import data
   */
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.history) {
        localStorage.setItem('detectionHistory', JSON.stringify(data.history));
      }
      if (data.analytics) {
        localStorage.setItem('analyticsData', JSON.stringify(data.analytics));
      }
      if (data.hotspots) {
        localStorage.setItem('pollutionHotspots', JSON.stringify(data.hotspots));
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

export const dataService = DataService.getInstance();