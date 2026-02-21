import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import {
  Download,
  Share2,
  ArrowLeft,
  CheckCircle,
  Package,
  Percent,
  ImageIcon,
  Play,
  Video,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { dataService, DetectionResult } from "@/services/data.service";
import { VideoPlayer } from "@/components/common/VideoPlayer";

// Backend API URL - change this if your backend runs on a different port
const API_URL = "http://localhost:8000";

// Empty fallback data structure
const emptyResult: DetectionResult = {
  success: false,
  filename: "",
  totalDetections: 0,
  detections: [],
  summary: [],
  annotatedImage: "",
  originalImage: "",
};

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function ResultsPage() {
  const { detectionId } = useParams<{ detectionId: string }>();
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadResults = async () => {
      // If we have a detection ID in URL, fetch from API
      if (detectionId) {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            toast({
              title: "Authentication Required",
              description: "Please login to view detection results",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }

          const response = await fetch(`${API_URL}/api/detections/${detectionId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(errorData.detail || 'Failed to fetch detection');
          }

          const data = await response.json();
          
          if (data.success && data.detection) {
            setResults([data.detection]);
            
            toast({
              title: "✅ Results Loaded",
              description: "Detection results loaded successfully",
              duration: 3000,
            });
          } else {
            throw new Error('Invalid response format');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          toast({
            title: "Error Loading Results",
            description: errorMessage,
            variant: "destructive",
          });
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Fallback to sessionStorage for immediate results after detection
        const storedResults = sessionStorage.getItem("detectionResults");
        if (storedResults) {
          try {
            const parsed = JSON.parse(storedResults);
            setResults(parsed);
            
            // Save results to data service for history and analytics
            parsed.forEach((result: DetectionResult) => {
              if (result.success) {
                dataService.saveDetectionResult(result);
              }
            });
            
            // Show completion notification for videos
            const hasVideo = parsed.some((r: DetectionResult) => r.annotatedVideo || r.annotatedVideoUrl);
            if (hasVideo) {
              toast({
                title: "🎬 Video Processing Complete!",
                description: "Your annotated video with frame-by-frame detections is ready to view",
                duration: 5000,
              });
            }

            toast({
              title: "✅ Results Saved",
              description: "Detection results have been saved to your history",
              duration: 3000,
            });
          } catch (error) {
            setResults([emptyResult]);
          }
        } else {
          setResults([emptyResult]);
        }
      }
    };

    loadResults();
  }, [detectionId, toast]);

  const currentResult = results[activeIndex] || emptyResult;
  const totalObjects = currentResult.totalDetections;
  const avgConfidence = currentResult.summary.length > 0
    ? Math.round(
        currentResult.summary.reduce((sum, s) => sum + s.avgConfidence, 0) /
          currentResult.summary.length
      )
    : 0;

  const isVideo = !!(currentResult.annotatedVideo || currentResult.annotatedVideoUrl || currentResult.totalFrames);
  
  const handleDownload = () => {
    if (currentResult.annotatedImage) {
      const link = document.createElement("a");
      link.href = currentResult.annotatedImage;
      link.download = `detected_${currentResult.filename}`;
      link.click();
      
      toast({
        title: "Download Started",
        description: `Downloading image: detected_${currentResult.filename}`,
      });
    } else if (currentResult.annotatedVideoUrl) {
      const link = document.createElement("a");
      link.href = `${API_URL}${currentResult.annotatedVideoUrl}`;
      link.download = `detected_${currentResult.filename}`;
      link.click();
      
      toast({
        title: "📥 Video Download Started",
        description: `Downloading processed video: detected_${currentResult.filename}`,
        duration: 4000,
      });
    } else if (currentResult.annotatedVideo) {
      const link = document.createElement("a");
      link.href = currentResult.annotatedVideo;
      link.download = `detected_${currentResult.filename}`;
      link.click();
      
      toast({
        title: "Download Started",
        description: `Downloading video: detected_${currentResult.filename}`,
      });
    } else {
      toast({
        title: "Download Not Available",
        description: "No processed media available for download",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <PageTransition className="page-container">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-semibold">Loading detection results...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="glass-card max-w-md">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                <p className="text-muted-foreground mb-4">
                  The detection results could not be loaded. This might happen if:
                </p>
                <ul className="text-sm text-muted-foreground text-left mb-4 space-y-1">
                  <li>• The detection was deleted</li>
                  <li>• You don't have permission to view it</li>
                  <li>• The detection ID is invalid</li>
                </ul>
                <div className="flex gap-2 justify-center">
                  <Button asChild variant="outline">
                    <Link to="/history">View History</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/upload">New Detection</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link
                to="/upload"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Upload
              </Link>
              <h1 className="section-header mb-0 flex items-center gap-2">
                Detection Results
                {isVideo && <Video className="h-6 w-6 text-primary" />}
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                {currentResult.filename}
                {isVideo && (
                  <Badge variant="secondary" className="text-xs">
                    <Play className="h-3 w-3 mr-1" />
                    Video
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={!currentResult.annotatedImage && !currentResult.annotatedVideo && !currentResult.annotatedVideoUrl && !isVideo}>
                <Download className="h-4 w-4 mr-2" />
                Download {isVideo ? 'Video' : 'Image'}
              </Button>
            </div>
          </div>

          {/* Multiple Results Tabs */}
          {results.length > 1 && (
            <Tabs
              value={activeIndex.toString()}
              onValueChange={(v) => setActiveIndex(parseInt(v))}
              className="mb-6"
            >
              <TabsList>
                {results.map((result, index) => (
                  <TabsTrigger key={index} value={index.toString()}>
                    {result.filename.slice(0, 20)}
                    {result.filename.length > 20 && "..."}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* File Saving Status - Show for videos */}


            {/* Image Comparison */}
            <div className="lg:col-span-2">
              <Card className="glass-card overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Before / After Comparison
                    {isVideo && (
                      <Badge variant="outline" className="text-xs">
                        <Video className="h-3 w-3 mr-1" />
                        {currentResult.totalFrames} frames
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Always show video/image content if we have any media or if it's a video result */}
                  {currentResult.annotatedImage || currentResult.annotatedVideo || currentResult.annotatedVideoUrl || isVideo ? (
                    <Tabs defaultValue="after" className="w-full">
                      <div className="px-4 pt-2">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="before">Original</TabsTrigger>
                          <TabsTrigger value="after">Detected</TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="before" className="mt-0">
                        <div className="relative aspect-video bg-muted">
                          {currentResult.originalImage ? (
                            <img
                              src={currentResult.originalImage}
                              alt="Original"
                              className="w-full h-full object-contain"
                            />
                          ) : currentResult.originalVideoUrl ? (
                            <VideoPlayer
                              src={`${API_URL}${currentResult.originalVideoUrl}`}
                              className="w-full h-full"
                              onError={(e) => {
                                console.error('Original video load error:', e);
                              }}
                            />
                          ) : currentResult.originalVideo ? (
                            <VideoPlayer
                              src={currentResult.originalVideo}
                              className="w-full h-full"
                              onError={(e) => {
                                console.error('Original video load error:', e);
                              }}
                            />
                          ) : isVideo ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <Video className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Original video not available</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      <TabsContent value="after" className="mt-0">
                        <div className="relative aspect-video bg-muted">
                          {currentResult.annotatedImage ? (
                            <img
                              src={currentResult.annotatedImage}
                              alt="Detected objects"
                              className="w-full h-full object-contain"
                            />
                          ) : currentResult.annotatedVideoUrl ? (
                            <div className="space-y-4">
                              <VideoPlayer
                                src={`${API_URL}${currentResult.annotatedVideoUrl}`}
                                className="w-full h-full"
                              />
                            </div>
                          ) : currentResult.annotatedVideo ? (
                            <VideoPlayer
                              src={currentResult.annotatedVideo}
                              className="w-full h-full"
                              onError={(e) => {
                                logger.error('Annotated video load error:', e);
                              }}
                            />
                          ) : isVideo ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <CheckCircle className="h-12 w-12 text-success mx-auto mb-2" />
                                <p className="text-lg font-semibold">Video Processed Successfully</p>
                                <p className="text-sm text-muted-foreground">
                                  {totalObjects} objects detected in {currentResult.totalFrames} frames
                                </p>
                                {currentResult.annotatedVideoUrl && (
                                  <Button
                                    className="mt-3"
                                    onClick={() => window.open(`${API_URL}${currentResult.annotatedVideoUrl}`, '_blank')}
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    View Processed Video
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="relative aspect-video bg-muted">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-24 h-24 rounded-full ocean-gradient mx-auto mb-4 flex items-center justify-center">
                            <CheckCircle className="h-12 w-12 text-white" />
                          </div>
                          <p className="text-lg font-semibold">Detection Complete</p>
                          <p className="text-muted-foreground text-sm">
                            {totalObjects} objects detected
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              <motion.div variants={fadeInUp}>
                <Card className="glass-card hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{totalObjects}</p>
                        <p className="text-sm text-muted-foreground">Total Objects</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="glass-card hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                        <Percent className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{avgConfidence}%</p>
                        <p className="text-sm text-muted-foreground">Avg Confidence</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Processing Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span>YOLO (Custom)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Classes</span>
                      <span>{currentResult.summary.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Detections</span>
                      <span>{currentResult.totalDetections}</span>
                    </div>
                    {currentResult.totalFrames && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Frames</span>
                          <span>{currentResult.totalFrames}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Processed Frames</span>
                          <span>{currentResult.processedFrames}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frames w/ Detections</span>
                          <span>{currentResult.framesWithDetections || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Detection Rate</span>
                          <span>{currentResult.detectionRate || 0}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg/Frame</span>
                          <span>{currentResult.avgDetectionsPerFrame || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{currentResult.duration}s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resolution</span>
                          <span>{currentResult.resolution}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">FPS</span>
                          <span>{currentResult.fps}</span>
                        </div>
                        {currentResult.fileSizeMB && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">File Size</span>
                            <span>{currentResult.fileSizeMB} MB</span>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>

          {/* Detection Details */}
          <Card className="glass-card mt-6">
            <CardHeader>
              <CardTitle>Detected Objects by Class</CardTitle>
            </CardHeader>
            <CardContent>
              {currentResult.summary.length > 0 ? (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {currentResult.summary.map((detection, index) => (
                    <motion.div
                      key={index}
                      variants={fadeInUp}
                      className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg hover-lift"
                    >
                      <div
                        className="w-3 h-12 rounded-full"
                        style={{ backgroundColor: chartColors[index % chartColors.length] }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{detection.class}</span>
                          <Badge variant="secondary">{detection.count}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${detection.avgConfidence}%` }}
                              transition={{ duration: 0.8, delay: index * 0.1 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: chartColors[index % chartColors.length] }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {detection.avgConfidence.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No objects detected in this image
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Bar */}
          <div className="flex gap-4 mt-6">
            <Button asChild className="flex-1">
              <Link to="/history">
                <CheckCircle className="mr-2 h-5 w-5" />
                Save to History
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/upload">New Detection</Link>
            </Button>
          </div>
        </div>
        )}
      </PageTransition>
    </MainLayout>
  );
}
