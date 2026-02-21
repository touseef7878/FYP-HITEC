import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

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

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
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
    logger.error('Video error:', e);
    setError('Failed to load video');
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

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        onError={handleError}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        controls
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <p className="text-sm mb-2">Video Error</p>
            <p className="text-xs text-red-300">{error}</p>
            <p className="text-xs text-gray-300 mt-1">URL: {src}</p>
          </div>
        </div>
      )}
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Loading video...</p>
          </div>
        </div>
      )}
    </div>
  );
};