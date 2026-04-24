import { useState, useCallback, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Image,
  Video,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileUp,
  Settings,
  Play,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ENV from "@/config/env";
import { DetectionResult, dataService } from "@/services/data.service";

const API_URL = ENV.API_URL;

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  errorMessage?: string;
  detectionId?: number;
}

// OPTIMIZED: Memoized file item component to prevent unnecessary re-renders
const FileItem = memo(({ file, isProcessing, onRemove }: {
  file: UploadFile;
  isProcessing: boolean;
  onRemove: (id: string) => void;
}) => {
  return (
    <motion.div
      key={file.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        {file.file.type.startsWith("image/") ? (
          <Image className="h-5 w-5 text-primary" />
        ) : (
          <Video className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {file.file.name}
        </p>
        {file.errorMessage && (
          <p className="text-xs text-destructive truncate">
            {file.errorMessage}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Progress value={file.progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground w-10">
            {file.progress}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {file.status === "complete" && (
          <CheckCircle className="h-5 w-5 text-success" />
        )}
        {file.status === "error" && (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
        {(file.status === "uploading" || file.status === "processing") && (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        )}
        {file.status === "pending" && !isProcessing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemove(file.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

FileItem.displayName = 'FileItem';

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [lastDetectionId, setLastDetectionId] = useState<number | undefined>(undefined);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token } = useAuth();

  // Monitor file completion status
  useEffect(() => {
    if (files.length > 0 && isProcessing) {
      const allComplete = files.every(f => f.status === "complete" || f.status === "error");
      const hasSuccessful = files.some(f => f.status === "complete");
      
      if (allComplete && hasSuccessful && !isComplete) {
        // Force completion state if all files are done but UI hasn't updated
        setTimeout(() => {
          if (isProcessing && !isComplete) {
            addLog("🔄 Forcing completion state update...");
            setIsProcessing(false);
            setIsComplete(true);
            setProcessingProgress(100);
          }
        }, 1000);
      }
    }
  }, [files, isProcessing, isComplete]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Estimate processing time based on video properties
  const estimateProcessingTime = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          const duration = video.duration; // in seconds
          const fileSize = file.size / (1024 * 1024); // in MB
          
          // Estimation formula: ~2-3 seconds per second of video + file size factor
          const baseTime = duration * 2.5; // 2.5 seconds per video second
          const sizeTime = fileSize * 0.1; // 0.1 seconds per MB
          const estimatedSeconds = Math.max(baseTime + sizeTime, 5); // minimum 5 seconds
          
          addLog(`📹 Video detected: ${duration.toFixed(1)}s duration, ${fileSize.toFixed(1)}MB`);
          addLog(`⏱️ Estimated processing time: ${estimatedSeconds.toFixed(0)} seconds`);
          
          resolve(estimatedSeconds);
        };
        
        video.onerror = () => {
          // Fallback estimation based on file size only
          const fileSize = file.size / (1024 * 1024);
          const estimatedSeconds = Math.max(fileSize * 0.5, 10);
          addLog(`⏱️ Estimated processing time: ${estimatedSeconds.toFixed(0)} seconds (based on file size)`);
          resolve(estimatedSeconds);
        };
        
        video.src = URL.createObjectURL(file);
      } else {
        // For images, much faster processing
        const fileSize = file.size / (1024 * 1024);
        const estimatedSeconds = Math.max(fileSize * 0.1, 2);
        addLog(`🖼️ Image detected: ${fileSize.toFixed(1)}MB`);
        addLog(`⏱️ Estimated processing time: ${estimatedSeconds.toFixed(0)} seconds`);
        resolve(estimatedSeconds);
      }
    });
  };

  // Check backend health
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      setBackendStatus("online");
      if (!data.yolo_model_loaded) {
        addLog("⚠️ Backend online but model not loaded. Add weights to backend/weights/best.pt");
        toast({
          title: "Model Not Loaded",
          description: "Please add your YOLO weights to backend/weights/best.pt",
          variant: "destructive",
        });
      } else {
        addLog("✓ Backend connected, model loaded");
      }
      return data.yolo_model_loaded;
    } catch {
      setBackendStatus("offline");
      addLog("✗ Backend not reachable. Start with: cd backend && python main.py");
      toast({
        title: "Backend Offline",
        description: "Start the Python backend: cd backend && python main.py",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    
    const newFiles: UploadFile[] = droppedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substring(2, 11),
      progress: 0,
      status: "pending",
    }));
    
    setFiles((prev) => [...prev, ...newFiles]);
    addLog(`Added ${droppedFiles.length} file(s) to queue`);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const selectedFiles = Array.from(e.target.files).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    
    const newFiles: UploadFile[] = selectedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substring(2, 11),
      progress: 0,
      status: "pending",
    }));
    
    setFiles((prev) => [...prev, ...newFiles]);
    addLog(`Added ${selectedFiles.length} file(s) to queue`);
  };

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    addLog("Removed file from queue");
  }, []);

  const processFiles = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setIsComplete(false);
    setProcessingProgress(0);

    addLog("Checking backend connection...");
    
    const modelLoaded = await checkBackendHealth();
    if (!modelLoaded) {
      setIsProcessing(false);
      return;
    }

    // Calculate total estimated time for all files
    let totalEstimatedTime = 0;
    for (const file of files) {
      const estimatedTime = await estimateProcessingTime(file.file);
      totalEstimatedTime += estimatedTime;
    }
    
    setEstimatedTime(totalEstimatedTime);
    addLog(`🚀 Starting detection pipeline for ${files.length} file(s)`);
    addLog(`⏱️ Total estimated time: ${Math.ceil(totalEstimatedTime)} seconds`);

    const results: DetectionResult[] = [];
    let processedTime = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.file.type.startsWith("video/");
      const fileEstimatedTime = await estimateProcessingTime(file.file);
      
      addLog(`Processing: ${file.file.name} ${isVideo ? '🎥' : '🖼️'}`);
      
      // Update to uploading status
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, progress: 20, status: "uploading" } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", file.file);

        const endpoint = isVideo ? "/detect-video" : "/detect";
        
        // Check if user is authenticated
        if (!token) {
          throw new Error("Not authenticated. Please login first.");
        }
        
        // Build API URL with optimization parameters
        let apiUrl = `${API_URL}${endpoint}?confidence=${confidence / 100}`;
        
        // Process all frames for maximum accuracy (no frame skipping)
        if (isVideo) {
          addLog(`🎯 Processing all frames for maximum accuracy`);
        }
        
        const startTime = Date.now();
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        // Update to processing status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress: 60, status: "processing" } : f
          )
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Detection failed");
        }

        const result = await response.json();
        
        // Store detection_id in the file object
        const detectionId = result.detection_id;
        
        // Update file with detection ID
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, detectionId: detectionId } : f
          )
        );

        // For videos: poll for completion since processing is async
        let finalResult = result;
        if (isVideo && result.status === "processing" && detectionId) {
          addLog(`🎬 Video queued for processing (ID: ${detectionId}). Polling for completion...`);
          
          finalResult = await new Promise<DetectionResult>((resolve, reject) => {
            const pollInterval = setInterval(async () => {
              try {
                const statusRes = await fetch(`${API_URL}/api/detections/${detectionId}/status`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!statusRes.ok) return;
                const statusData = await statusRes.json();
                
                const progress = statusData.progress ?? 0;
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === file.id ? { ...f, progress: Math.max(60, progress) } : f
                  )
                );
                
                if (statusData.status === 'completed') {
                  clearInterval(pollInterval);
                  addLog(`✅ Video processing complete! Fetching full results...`);

                  // Fetch the full detection result from the API instead of
                  // building a stub with empty summary/detections
                  try {
                    const fullRes = await fetch(`${API_URL}/api/detections/${detectionId}`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (fullRes.ok) {
                      const fullData = await fullRes.json();
                      if (fullData.success && fullData.detection) {
                        resolve(fullData.detection as DetectionResult);
                        return;
                      }
                    }
                  } catch (_) { /* fall through to stub */ }

                  // Fallback stub if full fetch fails
                  resolve({
                    success: true,
                    filename: statusData.filename || file.file.name,
                    totalDetections: statusData.total_detections || 0,
                    detections: [],
                    summary: [],
                    annotatedVideoUrl: statusData.annotated_video_url,
                    originalVideoUrl: statusData.original_video_url,
                    videoId: statusData.video_id,
                    result_id: String(detectionId),
                  } as DetectionResult);
                } else if (statusData.status === 'failed') {
                  clearInterval(pollInterval);
                  reject(new Error(statusData.error || 'Video processing failed'));
                }
              } catch (e) {
                // Silently continue polling on network errors
              }
            }, 2000); // Poll every 2 seconds
            

          });
        }
        
        const actualTime = (Date.now() - startTime) / 1000;
        processedTime += actualTime;
        
        results.push(finalResult);

        if (isVideo) {
          addLog(`✓ Video processed: ${result.totalDetections} objects detected in ${result.totalFrames} frames`);
          addLog(`📊 Video stats: ${result.duration}s duration, ${result.fps} FPS, ${result.resolution}`);
        } else {
          addLog(`✓ Image processed: ${result.totalDetections} objects detected`);
        }
        
        // Update to complete
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress: 100, status: "complete" } : f
          )
        );

        // Update overall progress
        const overallProgress = (processedTime / totalEstimatedTime) * 100;
        setProcessingProgress(Math.min(100, overallProgress));

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        addLog(`✗ Error processing ${file.file.name}: ${message}`);
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "error", errorMessage: message }
              : f
          )
        );
      }
    }

    if (results.length > 0) {
      const totalDetections = results.reduce((sum, r) => sum + r.totalDetections, 0);
      const videoCount = results.filter(r => r.annotatedVideoUrl).length;
      
      addLog(`🎉 All files processed! Total detections: ${totalDetections}`);
      
      // Store results in sessionStorage for immediate viewing (fallback)
      sessionStorage.setItem("detectionResults", JSON.stringify(results));
      
      // IMMEDIATELY set completion state and stop processing
      setIsProcessing(false);
      setProcessingProgress(100);
      setIsComplete(true);
      
      // Show completion notification
      toast({
        title: "🎉 Detection Complete!",
        description: `Successfully processed ${results.length} file(s) with ${totalDetections} total detections`,
        duration: 5000,
      });

      // Show completion popup for videos
      const hasVideo = results.some(r => r.annotatedVideo || r.annotatedVideoUrl);
      if (hasVideo) {
        toast({
          title: "🎬 Video Processing Complete!",
          description: "Click 'View Results Now' or wait for automatic redirect",
          duration: 6000,
        });
      }

      // Navigate to results with detection ID (use first result's ID)
      // Get detection ID from the files array (which was updated with detection IDs)
      const firstFileWithDetection = files.find(f => f.detectionId);
      const firstDetectionId = firstFileWithDetection?.detectionId
        || results[0]?.detection_id
        || (results[0]?.result_id ? parseInt(results[0].result_id) : undefined);
      
      setLastDetectionId(firstDetectionId);
      
      setTimeout(() => {
        addLog("🚀 Auto-redirecting to results...");
        setIsComplete(false);
        setProcessingProgress(0);
        setEstimatedTime(null);

        // Fire the event AFTER navigation — History/Dashboard listeners
        // are no longer mounted, so no background refetch hits the Results page
        localStorage.setItem('detection_completed', Date.now().toString());
        window.dispatchEvent(new Event('detectionComplete'));

        if (firstDetectionId) {
          addLog(`📍 Navigating to detection ID: ${firstDetectionId}`);
          navigate(`/results/${firstDetectionId}`);
        } else {
          addLog(`📍 Navigating to results (using sessionStorage)`);
          navigate("/results");
        }
      }, 3000);    } else {
      setIsProcessing(false);
      setIsComplete(false);
      setProcessingProgress(0);
      toast({
        title: "Processing Failed",
        description: "No files were processed successfully",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="section-header mb-1">Upload & Detect</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Upload images or videos to detect marine plastic debris
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    backendStatus === "online" && "bg-success",
                    backendStatus === "offline" && "bg-destructive",
                    backendStatus === "unknown" && "bg-muted-foreground"
                  )}
                />
                <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
                  {backendStatus === "unknown" ? "Not checked" : backendStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Settings */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings} className="mb-4 sm:mb-5">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="mb-2 text-xs sm:text-sm">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Detection Settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="glass-card">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs sm:text-sm font-medium mb-2 block">
                        Confidence Threshold: {confidence}%
                      </label>
                      <Slider
                        value={[confidence]}
                        onValueChange={(value) => setConfidence(value[0])}
                        min={10} max={90} step={5}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lower = detects more objects (recommended: 10–20%). Higher = fewer but more certain detections.
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={checkBackendHealth} className="text-xs">
                      Check Backend Connection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Drop Zone */}
          <Card
            className={cn(
              "glass-card mb-4 sm:mb-6 transition-colors duration-200 cursor-pointer",
              isDragOver && "ring-2 ring-primary border-primary bg-primary/5"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <CardContent className="py-6 sm:py-10 px-4">
              <label className="flex flex-col items-center justify-center cursor-pointer">
                <div
                  className={cn(
                    "w-14 h-14 sm:w-16 sm:h-16 rounded-full ocean-gradient flex items-center justify-center mb-3 transition-transform duration-200",
                    isDragOver && "scale-110"
                  )}
                >
                  <FileUp className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-1.5">
                  {isDragOver ? "Drop files here" : "Drag & drop files"}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm mb-3 text-center">
                  or click to browse (Images & Videos supported)
                </p>
                <div className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Image className="h-3.5 w-3.5" /> PNG, JPG, JPEG
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="h-3.5 w-3.5" /> MP4, AVI, MOV
                  </span>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </CardContent>
          </Card>

          {/* File List */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Upload Queue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {files.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        isProcessing={isProcessing}
                        onRemove={removeFile}
                      />
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing Progress */}
          <AnimatePresence>
            {(isProcessing || isComplete || estimatedTime) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : isProcessing ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      {isComplete ? "Processing Complete!" : isProcessing ? "Processing in Progress..." : "Ready to Process"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {estimatedTime && !isComplete && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Estimated Time: {Math.ceil(estimatedTime)} seconds
                        </span>
                        <span className="text-muted-foreground">
                          Progress: {Math.round(processingProgress)}%
                        </span>
                      </div>
                    )}
                    <Progress 
                      value={processingProgress} 
                      className={`h-2 ${isComplete ? 'bg-success/20' : ''}`}
                    />
                    {isComplete && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-success text-sm">
                          <CheckCircle className="h-4 w-4" />
                          All files processed successfully! Redirecting to results...
                        </div>
                      </div>
                    )}
                    {isProcessing && !isComplete && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing files... Please wait
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-2 sm:gap-3">
            <Button
              size="lg"
              className="flex-1 text-sm sm:text-base"
              onClick={processFiles}
              disabled={files.length === 0 || isProcessing || isComplete}
            >
              {isComplete ? (
                <><CheckCircle className="mr-2 h-4 w-4 text-green-400" />Complete! Redirecting...</>
              ) : isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Start Detection</>
              )}
            </Button>

            {isComplete && (
              <Button
                variant="secondary"
                size="lg"
                className="text-sm sm:text-base"
                onClick={() => {
                  if (lastDetectionId) navigate(`/results/${lastDetectionId}`);
                  else navigate("/results");
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">View Results Now</span>
                <span className="sm:hidden">View</span>
              </Button>
            )}
            
            {files.length > 0 && !isProcessing && !isComplete && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setFiles([]);
                  setLogs([]);
                  setEstimatedTime(null);
                  setProcessingProgress(0);
                }}
              >
                <X className="mr-2 h-5 w-5" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}