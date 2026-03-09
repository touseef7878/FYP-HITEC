import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import logger from '@/utils/logger';

interface VideoPlayerProps {
  src: string;
  className?: string;
  onError?: (error: any) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  className = "",
  onError,
  onLoadStart,
  onCanPlay
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          logger.error('Play error:', err);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleError = (e: any) => {
    const videoElement = e.target as HTMLVideoElement;
    let errorMessage = 'Failed to load video';
    
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case 1:
          errorMessage = 'Video loading aborted';
          break;
        case 2:
          errorMessage = 'Network error while loading video';
          break;
        case 3:
          errorMessage = 'Video format not supported';
          break;
        case 4:
          errorMessage = 'Video not found or access denied';
          break;
        default:
          errorMessage = 'Unknown video error';
      }
    }
    
    logger.error('Video error:', errorMessage, 'URL:', src);
    setError(errorMessage);
    setIsLoading(false);
    onError?.(e);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setError(null);
    onLoadStart?.();
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    onCanPlay?.();
  };
  
  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {!hasInteracted ? (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/80 cursor-pointer z-10 rounded-lg"
          onClick={handleInteraction}
        >
          <div className="text-center text-white">
            <Play className="h-16 w-16 mx-auto mb-2" />
            <p className="text-sm">Click to load video</p>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain rounded-lg"
          preload="metadata"
          playsInline
          onError={handleError}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls
        />
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 rounded-lg">
          <div className="text-center text-white p-4">
            <p className="text-sm mb-2 font-semibold">Video Error</p>
            <p className="text-xs text-red-300 mb-2">{error}</p>
            <p className="text-xs text-gray-400 break-all">URL: {src}</p>
          </div>
        </div>
      )}
      
      {isLoading && hasInteracted && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 rounded-lg">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Loading video...</p>
          </div>
        </div>
      )}
    </div>
  );
};