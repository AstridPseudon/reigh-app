import React, { useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { getThumbPath } from './VideoWithPoster';

/**
 * Side-by-side comparison slider for motion reference vs result videos.
 * Self-contained: manages its own playback, slider position, and fade state.
 */
export const MotionComparison: React.FC = () => {
  const [sliderPos, setSliderPos] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoInputRef = useRef<HTMLVideoElement>(null);
  const videoOutputRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = () => {
    const video = videoOutputRef.current;
    if (!video) return;

    const timeRemaining = video.duration - video.currentTime;
    if (timeRemaining <= 5) {
      // Fade from 0 to 1 over 5 seconds
      setFadeOpacity(1 - (timeRemaining / 5));
    } else {
      setFadeOpacity(0);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !isPlaying) return;
    setIsAnimating(false); // Stop animation when user drags
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current || !isPlaying) return;
    setIsAnimating(false); // Stop animation when user drags
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX;
    const x = Math.max(0, Math.min(touchX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const togglePlay = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const nextIsPlaying = !isPlaying;
    setIsPlaying(nextIsPlaying);

    if (nextIsPlaying) {
      setIsAnimating(true);
      setSliderPos(20); // Start showing 80% of the result
      videoInputRef.current?.play().catch(() => {});
      videoOutputRef.current?.play().catch(() => {});
      // Sync durations by slowing down input if needed
      if (videoInputRef.current && videoOutputRef.current) {
         if (videoOutputRef.current.duration && videoInputRef.current.duration) {
             const ratio = videoInputRef.current.duration / videoOutputRef.current.duration;
             videoInputRef.current.playbackRate = ratio;
         }
      }
    } else {
      setIsAnimating(true);
      videoInputRef.current?.pause();
      videoOutputRef.current?.pause();
      setSliderPos(50);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-lg overflow-hidden cursor-col-resize group select-none border border-muted/50 touch-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onClick={togglePlay}
      onMouseLeave={() => !isPlaying && setSliderPos(50)}
    >
      {/* Output Video (Right / Background) */}
      <video
        ref={videoOutputRef}
        src="/motion-output.mp4"
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onSeeked={() => setFadeOpacity(0)}
      />
      {/* Output poster overlay - thumbnail first, then full */}
      <img
        src={getThumbPath('/motion-output-poster.jpg')}
        alt=""
        className={cn("absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300", isPlaying && "opacity-0")}
      />

      {/* Input Video (Left / Foreground) - Clipped */}
      <div
        className={cn("absolute inset-0 overflow-hidden", isAnimating && "transition-[clip-path] duration-500 ease-out")}
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <video
          ref={videoInputRef}
          src="/motion-input.mp4"
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            if (videoOutputRef.current?.duration) {
               video.playbackRate = video.duration / videoOutputRef.current.duration;
            }
          }}
        />
        {/* Input poster overlay - thumbnail first */}
        <img
          src={getThumbPath('/motion-input-poster.jpg')}
          alt=""
          className={cn("absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300", isPlaying && "opacity-0")}
        />
      </div>

      {/* Slider Handle - Only visible when playing */}
      {isPlaying && (
        <div
          className={cn("absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none z-10", isAnimating && "transition-[left] duration-500 ease-out")}
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 shadow-lg">
            <svg className="w-4 h-4 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h8m-8 0l4-4m-4 4l4 4" />
            </svg>
          </div>
        </div>
      )}

      {/* Labels */}
      <div className={`absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-[10px] uppercase tracking-wider text-white/90 font-bold transition-opacity duration-300 pointer-events-none z-20 ${sliderPos < 15 ? 'opacity-0' : 'opacity-100'}`}>
        Reference
      </div>
      <div className={`absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-[10px] uppercase tracking-wider text-white/90 font-bold transition-opacity duration-300 pointer-events-none z-20 ${sliderPos > 85 ? 'opacity-0' : 'opacity-100'}`}>
        Result
      </div>

      {/* Play Button Overlay */}
      <div
        className={`absolute inset-0 flex items-center justify-center z-30 transition-all duration-300 ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100 bg-black/20'}`}
      >
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-xl text-white transform transition-transform group-hover:scale-110">
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      {/* Mute Button - Bottom Right */}
      <button
        onClick={toggleMute}
        className="absolute bottom-3 right-3 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/90 hover:bg-black/70 transition-colors z-40"
      >
        {isMuted ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Fade to black overlay */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-50"
        style={{ opacity: fadeOpacity }}
      />
    </div>
  );
};
