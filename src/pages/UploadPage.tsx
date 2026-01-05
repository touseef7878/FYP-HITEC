import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Backend API URL - change this if your backend runs on a different port
const API_URL = "http://localhost:8000";

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  errorMessage?: string;
}

interface DetectionResult {
  success: boolean;
  filename: string;
  totalDetections: number;
  detections: {
    class: string;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number };
  }[];
  summary: {
    class: string;
    count: number;
    avgConfidence: number;
  }[];
  annotatedImage?: string;
  originalImage?: string;
  annotatedVideo?: string;
  originalVideo?: string;
  annotatedVideoUrl?: string;  // New URL-based field
  originalVideoUrl?: string;   // New URL-based field
  totalFrames?: number;
  processedFrames?: number;
  fps?: number;
  duration?: number;
  resolution?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(25);
  const [showSettings, setShowSettings] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    addLog("Removed file from queue");
  };

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
        
        const startTime = Date.now();
        const response = await fetch(
          `${API_URL}${endpoint}?confidence=${confidence / 100}`,
          {
            method: "POST",
            body: formData,
          }
        );

        // Update to processing status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress: 60, status: "processing" } : f
          )
        );

        // Simulate progress updates during processing
        const progressInterval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const progress = Math.min(90, 60 + (elapsed / fileEstimatedTime) * 30);
          
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, progress: Math.round(progress) } : f
            )
          );
          
          // Update overall progress
          const overallProgress = ((processedTime + elapsed) / totalEstimatedTime) * 100;
          setProcessingProgress(Math.min(95, overallProgress));
        }, 500);

        if (!response.ok) {
          clearInterval(progressInterval);
          const error = await response.json();
          throw new Error(error.detail || "Detection failed");
        }

        const result = await response.json();
        clearInterval(progressInterval);
        
        const actualTime = (Date.now() - startTime) / 1000;
        processedTime += actualTime;
        
        results.push(result);

        if (isVideo) {
          addLog(`✓ Video processed: ${result.totalDetections} objects detected in ${result.totalFrames} frames`);
          addLog(`📊 Video stats: ${result.duration}s duration, ${result.fps} FPS, ${result.resolution}`);
          if (result.annotatedVideoUrl) {
            addLog(`💾 Processed video saved to: backend/processed_videos/`);
            addLog(`🌐 Video accessible at: ${API_URL}${result.annotatedVideoUrl}`);
            addLog(`📁 Local file: processed_${result.videoId}.mp4`);
          }
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
        
        // Debug log
        addLog(`📊 File ${i + 1}/${files.length} complete. Overall progress: ${Math.round(overallProgress)}%`);

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
      if (videoCount > 0) {
        addLog(`💾 ${videoCount} processed video(s) saved to: backend/processed_videos/`);
        addLog(`📂 You can find your files in the project's backend/processed_videos/ folder`);
      }
      
      // Store results in sessionStorage to pass to results page
      sessionStorage.setItem("detectionResults", JSON.stringify(results));
      
      // IMMEDIATELY set completion state and stop processing
      setIsProcessing(false); // Stop processing FIRST
      setProcessingProgress(100); // Set progress to 100%
      setIsComplete(true); // Set completion state
      
      // Show completion notification
      toast({
        title: "🎉 Detection Complete!",
        description: `Successfully processed ${results.length} file(s) with ${totalDetections} total detections. Files saved to backend/processed_videos/`,
        duration: 5000,
      });

      // Show completion popup for videos with direct access
      const hasVideo = results.some(r => r.annotatedVideo || r.annotatedVideoUrl);
      if (hasVideo) {
        const videoResult = results.find(r => r.annotatedVideoUrl);
        if (videoResult?.annotatedVideoUrl) {
          addLog(`🎬 Direct video link: ${API_URL}${videoResult.annotatedVideoUrl}`);
          addLog(`💾 Video file saved in: backend/processed_videos/ folder`);
        }
        
        // Show file saving notification
        toast({
          title: "💾 Video Saved Successfully!",
          description: "Processed video saved to backend/processed_videos/ folder and ready for download",
          duration: 6000,
        });
        
        toast({
          title: "🎬 Video Processing Complete!",
          description: "Click 'View Results Now' or wait for automatic redirect",
          duration: 6000,
        });
      }

      // Navigate to results after showing completion (longer delay to show completion state)
      setTimeout(() => {
        addLog("🚀 Auto-redirecting to results...");
        setIsComplete(false); // Clear completion state
        setProcessingProgress(0); // Reset progress
        setEstimatedTime(null); // Clear estimated time
        navigate("/results");
      }, 5000); // Increased delay to show completion state longer
    } else {
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="section-header">Upload & Detect</h1>
                <p className="text-muted-foreground">
                  Upload images or videos for AI-powered marine plastic detection
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    backendStatus === "online" && "bg-success",
                    backendStatus === "offline" && "bg-destructive",
                    backendStatus === "unknown" && "bg-muted-foreground"
                  )}
                />
                <span className="text-sm text-muted-foreground capitalize">
                  {backendStatus === "unknown" ? "Not checked" : backendStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Settings */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings} className="mb-6">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="mb-2">
                <Settings className="mr-2 h-4 w-4" />
                Detection Settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Confidence Threshold: {confidence}%
                      </label>
                      <Slider
                        value={[confidence]}
                        onValueChange={(value) => setConfidence(value[0])}
                        min={10}
                        max={90}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher values = fewer but more confident detections
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={checkBackendHealth}>
                        Check Backend Connection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Drop Zone */}
          <Card
            className={cn(
              "glass-card mb-6 transition-all duration-300 cursor-pointer",
              isDragOver && "ring-2 ring-primary border-primary"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <CardContent className="py-12">
              <label className="flex flex-col items-center justify-center cursor-pointer">
                <motion.div
                  animate={isDragOver ? { scale: 1.1 } : { scale: 1 }}
                  className="w-20 h-20 rounded-full ocean-gradient flex items-center justify-center mb-4"
                >
                  <FileUp className="h-10 w-10 text-white" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-2">
                  {isDragOver ? "Drop files here" : "Drag & drop files"}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  or click to browse (Images & Videos supported)
                </p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Image className="h-4 w-4" /> PNG, JPG, JPEG
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="h-4 w-4" /> MP4, AVI, MOV
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
                              onClick={() => removeFile(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
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
                        {/* Show direct video links if available */}
                        {(() => {
                          const storedResults = sessionStorage.getItem("detectionResults");
                          if (storedResults) {
                            try {
                              const results = JSON.parse(storedResults);
                              const videoResults = results.filter((r: any) => r.annotatedVideoUrl);
                              if (videoResults.length > 0) {
                                return (
                                  <div className="mt-3 space-y-3">
                                    {/* File Saving Status */}
                                    <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                                      <div className="flex items-center gap-2 text-success text-sm font-medium mb-2">
                                        <CheckCircle className="h-4 w-4" />
                                        💾 Files Saved Successfully
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Processed videos saved to: <code className="bg-muted px-1 rounded">backend/processed_videos/</code>
                                      </p>
                                    </div>
                                    
                                    {/* Video Access */}
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                      <p className="text-sm font-medium mb-2">🎬 Processed Videos:</p>
                                      {videoResults.map((result: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between text-sm mb-2 last:mb-0">
                                          <div className="flex-1 min-w-0">
                                            <p className="truncate mr-2 font-medium">{result.filename}</p>
                                            <p className="text-xs text-muted-foreground">
                                              📁 processed_{result.videoId}.mp4
                                            </p>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.open(`${API_URL}${result.annotatedVideoUrl}`, '_blank')}
                                          >
                                            <Play className="h-3 w-3 mr-1" />
                                            View
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                            } catch (e) {
                              console.error('Error parsing results:', e);
                            }
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    {isProcessing && !isComplete && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing files... Please wait
                        </div>
                        {/* Manual completion button if processing seems stuck */}
                        {processingProgress >= 95 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              addLog("🔄 Manual completion triggered...");
                              setIsProcessing(false);
                              setIsComplete(true);
                              setProcessingProgress(100);
                            }}
                          >
                            Complete Processing
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing Logs */}
          <AnimatePresence>
            {logs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-6"
              >
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Processing Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm max-h-48 overflow-y-auto">
                      {logs.map((log, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-muted-foreground"
                        >
                          {log}
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={processFiles}
              disabled={files.length === 0 || isProcessing || isComplete}
            >
              {isComplete ? (
                <>
                  <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                  Complete! Redirecting...
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Start Detection
                </>
              )}
            </Button>
            
            {/* View Results Button - shows when processing is complete */}
            {isComplete && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setIsProcessing(false);
                  setIsComplete(false);
                  setProcessingProgress(0);
                  setEstimatedTime(null);
                  navigate("/results");
                }}
              >
                <Play className="mr-2 h-5 w-5" />
                View Results Now
              </Button>
            )}
            
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setFiles([]);
                setLogs([]);
                setIsComplete(false);
                setIsProcessing(false);
                setProcessingProgress(0);
                setEstimatedTime(null);
              }}
              disabled={isProcessing}
            >
              Clear All
            </Button>
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
