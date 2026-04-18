/**
 * Database Service for Marine Plastic Detection Platform
 * Handles API calls to the SQLite database backend
 */

import ENV from '@/config/env';

const API_URL = ENV.API_URL;

export interface DatabaseDetectionResult {
  id: number;
  filename: string;
  file_type: string;
  total_detections: number;
  total_frames?: number;
  processed_frames?: number;
  frames_with_detections?: number;
  detection_rate?: number;
  avg_detections_per_frame?: number;
  fps?: number;
  duration?: number;
  resolution?: string;
  file_size_mb?: number;
  confidence_threshold: number;
  annotated_video_url?: string;
  original_video_url?: string;
  video_id?: string;
  processing_stats?: any;
  detections_data?: any[];
  summary_data?: any[];
  created_at: string;
  updated_at: string;
  detected_classes?: string[];
  unique_classes_count?: number;
  classes?: any[];
  detections?: any[];
}

export interface AnalyticsData {
  summary: {
    total_detections: number;
    total_files: number;
    total_videos: number;
    total_images: number;
    overall_avg_confidence: number;
  };
  daily_data: Array<{
    date: string;
    total_detections: number;
    total_files_processed: number;
    total_videos_processed: number;
    total_images_processed: number;
    avg_confidence: number;
  }>;
  class_distribution: Array<{
    class_name: string;
    total_count: number;
    avg_conf: number;
  }>;
  date_range: {
    start: string;
    end: string;
    days: number;
  };
}

class DatabaseService {
  private static instance: DatabaseService;

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  /**
   * Get detection history from database
   */
  async getDetectionHistory(limit: number = 50, offset: number = 0): Promise<DatabaseDetectionResult[]> {
    try {
      const response = await fetch(`${API_URL}/api/history?limit=${limit}&offset=${offset}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication required. Please log in.');
          // Clear invalid token
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.history;
      } else {
        throw new Error('Failed to fetch history');
      }
    } catch (error) {
      console.error('Error fetching detection history:', error);
      return [];
    }
  }

  /**
   * Get analytics data from database
   */
  async getAnalyticsData(days: number = 30): Promise<AnalyticsData | null> {
    try {
      const response = await fetch(`${API_URL}/api/analytics?days=${days}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication required. Please log in.');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.analytics;
      } else {
        throw new Error('Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      return null;
    }
  }

  /**
   * Get specific detection result by ID
   */
  async getDetectionResult(resultId: number): Promise<DatabaseDetectionResult | null> {
    try {
      const response = await fetch(`${API_URL}/api/detection/${resultId}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication required. Please log in.');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.result;
      } else {
        throw new Error('Failed to fetch detection result');
      }
    } catch (error) {
      console.error('Error fetching detection result:', error);
      return null;
    }
  }

  /**
   * Check if backend database is available
   */
  async checkDatabaseHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}
  formatDetectionResult(dbResult: DatabaseDetectionResult): any {
    return {
      success: true,
      filename: dbResult.filename,
      totalDetections: dbResult.total_detections,
      totalFrames: dbResult.total_frames,
      processedFrames: dbResult.processed_frames,
      framesWithDetections: dbResult.frames_with_detections,
      detectionRate: dbResult.detection_rate,
      avgDetectionsPerFrame: dbResult.avg_detections_per_frame,
      fps: dbResult.fps,
      duration: dbResult.duration,
      resolution: dbResult.resolution,
      fileSizeMB: dbResult.file_size_mb,
      annotatedVideoUrl: dbResult.annotated_video_url,
      originalVideoUrl: dbResult.original_video_url,
      videoId: dbResult.video_id,
      processingStats: dbResult.processing_stats,
      detections: dbResult.detections_data || dbResult.detections || [],
      summary: dbResult.summary_data || dbResult.classes?.map(c => ({
        class: c.class_name,
        count: c.count,
        avgConfidence: c.avg_confidence,
        framesAppeared: c.frames_appeared,
        appearanceRate: c.appearance_rate
      })) || [],
      databaseId: dbResult.id,
      createdAt: dbResult.created_at,
      updatedAt: dbResult.updated_at
    };
  }

  /**
   * Get recent detection results for results page
   */
  async getRecentResults(limit: number = 5): Promise<any[]> {
    try {
      const dbResults = await this.getDetectionHistory(limit, 0);
      return dbResults.map(result => this.formatDetectionResult(result));
    } catch (error) {
      console.error('Error fetching recent results:', error);
      return [];
    }
  }

  /**
   * Check if backend database is available
   */
  async checkDatabaseHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const databaseService = DatabaseService.getInstance();