import { useState, useCallback } from "react";
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
  annotatedImage: string;
  originalImage: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(25);
  const [showSettings, setShowSettings] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const navigate = useNavigate();
  const { toast } = useToast();

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Check backend health
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      setBackendStatus("online");
      if (!data.model_loaded) {
        addLog("⚠️ Backend online but model not loaded. Add weights to backend/weights/best.pt");
        toast({
          title: "Model Not Loaded",
          description: "Please add your YOLO weights to backend/weights/best.pt",
          variant: "destructive",
        });
      } else {
        addLog("✓ Backend connected, model loaded");
      }
      return data.model_loaded;
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
    addLog("Checking backend connection...");
    
    const modelLoaded = await checkBackendHealth();
    if (!modelLoaded) {
      setIsProcessing(false);
      return;
    }

    addLog("Starting detection pipeline...");
    const results: DetectionResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.file.type.startsWith("video/");
      addLog(`Processing: ${file.file.name}`);
      
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

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Detection failed");
        }

        const result = await response.json();
        results.push(result);

        addLog(`✓ Detected ${result.totalDetections} objects in ${file.file.name}`);
        
        // Update to complete
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress: 100, status: "complete" } : f
          )
        );

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
      addLog(`All files processed! Total detections: ${results.reduce((sum, r) => sum + r.totalDetections, 0)}`);
      
      // Store results in sessionStorage to pass to results page
      sessionStorage.setItem("detectionResults", JSON.stringify(results));
      
      toast({
        title: "Detection Complete",
        description: `Processed ${results.length} file(s) successfully`,
      });

      // Navigate to results after short delay
      setTimeout(() => navigate("/results"), 1000);
    }

    setIsProcessing(false);
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
              disabled={files.length === 0 || isProcessing}
            >
              {isProcessing ? (
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
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setFiles([]);
                setLogs([]);
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
