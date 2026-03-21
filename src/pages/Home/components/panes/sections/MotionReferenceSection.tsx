import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/components/ui/contracts/cn';

const INTRO_IMAGES = [
  '/intro-1.jpg', '/intro-2.jpg', '/intro-3.jpg', '/intro-4.jpg',
  '/intro-5.jpg', '/intro-6.jpg', '/intro-7.jpg', '/intro-8.jpg',
];

interface MotionReferenceSectionProps {
  loadedImages: Set<string>;
  handleImageLoad: (src: string) => void;
  handleImageRef: (img: HTMLImageElement | null, src: string) => void;
}

export function MotionReferenceSection({
  loadedImages,
  handleImageLoad,
  handleImageRef,
}: MotionReferenceSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-7">
        You can use <span className="text-wes-vintage-gold">video references to control the camera movement</span> - here's an example of how images and video references combine:
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1">
          {INTRO_IMAGES.map((imgSrc, idx) => (
            <div key={idx} className="aspect-square bg-muted/30 rounded border border-muted/50 overflow-hidden relative">
              <img
                src={imgSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <img
                ref={(imgEl) => handleImageRef(imgEl, imgSrc)}
                src={imgSrc}
                alt={`Input ${idx + 1}`}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                  !loadedImages.has(imgSrc) && 'opacity-0',
                )}
                onLoad={() => handleImageLoad(imgSrc)}
              />
            </div>
          ))}
        </div>

        <div
          className="w-full relative cursor-pointer"
          onClick={togglePlay}
        >
          <div className="aspect-video bg-muted/30 rounded-lg border border-muted/50 overflow-hidden relative">
            <video
              ref={videoRef}
              src="/intro-output.mp4"
              muted={isMuted}
              playsInline
              preload="metadata"
              onEnded={handleEnded}
              className="w-full h-full object-cover"
            />

            <img
              src="/intro-output-poster.jpg"
              alt=""
              className={cn(
                'absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300',
                isPlaying ? 'opacity-0' : 'opacity-100',
              )}
            />

            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 rounded-lg transition-all duration-300 z-20 group">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}

            {isPlaying && (
              <button
                onClick={toggleMute}
                className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center transition-all duration-200"
              >
                {isMuted ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
