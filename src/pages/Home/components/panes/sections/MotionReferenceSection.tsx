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

        <div className="w-full relative">
          <div className="aspect-video bg-muted/30 rounded-lg border border-muted/50 overflow-hidden relative">
            <video
              ref={videoRef}
              src="/intro-output.mp4"
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
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 rounded-lg transition-all duration-300 z-20 group"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
