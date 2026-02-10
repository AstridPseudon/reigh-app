import { useState, useEffect, useCallback, CSSProperties } from 'react';

type AnimationPhase = 'initial' | 'loading' | 'bar-complete' | 'content-revealing' | 'complete';
type BanodocoState = 'hidden' | 'animating' | 'visible';

interface UseHeroAnimationOptions {
  assetsLoaded: boolean;
}

interface UseHeroAnimationReturn {
  phase: AnimationPhase;
  banodocoState: BanodocoState;
  barWidth: string;
  /** Stagger-based fade+translate style for content sections */
  getFadeStyle: (delayIndex: number, distance?: number, forceWait?: boolean) => CSSProperties;
  /** Scale-based pop-in style for social icons etc. */
  getPopStyle: (absoluteDelay: number, forceWait?: boolean) => CSSProperties;
}

export function useHeroAnimation({ assetsLoaded }: UseHeroAnimationOptions): UseHeroAnimationReturn {
  const [phase, setPhase] = useState<AnimationPhase>('initial');
  const [banodocoState, setBanodocoState] = useState<BanodocoState>('hidden');
  const [minLoadTimePassed, setMinLoadTimePassed] = useState(false);
  const [barWidth, setBarWidth] = useState('0%');

  // Enforce minimum loading time
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadTimePassed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Loading bar animation
  useEffect(() => {
    setBarWidth(assetsLoaded ? '100%' : '92%');
  }, [assetsLoaded]);

  // Master animation orchestrator
  useEffect(() => {
    if (phase === 'initial') {
      // Start after brief mount delay
      const timer = setTimeout(() => setPhase('loading'), 100);
      return () => clearTimeout(timer);
    }

    if (phase === 'loading' && assetsLoaded && minLoadTimePassed) {
      // Bar has reached 100%, wait for it to settle
      const timer = setTimeout(() => setPhase('bar-complete'), 300);
      return () => clearTimeout(timer);
    }

    if (phase === 'bar-complete') {
      // Start content reveal immediately
      setPhase('content-revealing');
      // Mark as complete after animations finish (1000ms content + buffer)
      const timer = setTimeout(() => setPhase('complete'), 1050);
      return () => clearTimeout(timer);
    }

    if (phase === 'content-revealing') {
      // Trigger Banodoco after second social icon + 500ms pause (950ms + 500ms = 1450ms)
      const banodocoTimer = setTimeout(() => {
        setBanodocoState('animating');
        setTimeout(() => setBanodocoState('visible'), 1800); // 1800ms animation duration
      }, 1450);

      return () => {
        clearTimeout(banodocoTimer);
      };
    }
  }, [phase, assetsLoaded, minLoadTimePassed]);

  // Helper for staggering animations based on animation phase
  // Calculated to match the grid-template-rows expansion (1000ms ease-out)
  const getFadeStyle = useCallback((delayIndex: number, distance: number = 0, forceWait: boolean = false): CSSProperties => {
    const duration = '1000ms';
    // Special case for subtitle (-60) and title (20) to make them slightly faster (0.8s)
    const actualDuration = (distance === -60 || distance === 20) ? '800ms' : duration;

    const delay = delayIndex * 0.1;
    const isRevealing = phase === 'content-revealing' || phase === 'complete';
    const isVisible = isRevealing && !forceWait;

    return {
      opacity: isVisible ? 1 : 0,
      transition: `opacity ${actualDuration} ease-out ${delay}s, transform ${actualDuration} cubic-bezier(0.2, 0, 0.2, 1) ${delay}s`,
      transform: isVisible ? 'translateY(0)' : `translateY(${distance}px)`,
      willChange: 'transform, opacity'
    };
  }, [phase]);

  // Helper for pop-in animations (scale-based, independent of other animations)
  const getPopStyle = useCallback((absoluteDelay: number, forceWait: boolean = false): CSSProperties => {
    const duration = '400ms';
    // Use absolute delay in seconds (e.g., 1.5 = 1500ms after content-revealing starts)
    const isRevealing = phase === 'content-revealing' || phase === 'complete';
    const isVisible = isRevealing && !forceWait;

    return {
      opacity: isVisible ? 1 : 0,
      transition: `opacity ${duration} ease-out ${absoluteDelay}s, transform ${duration} cubic-bezier(0.34, 1.56, 0.64, 1) ${absoluteDelay}s`,
      transform: isVisible ? 'scale(1)' : 'scale(0)',
      willChange: 'transform, opacity',
      transformOrigin: 'center center'
    };
  }, [phase]);

  return {
    phase,
    banodocoState,
    barWidth,
    getFadeStyle,
    getPopStyle,
  };
}
