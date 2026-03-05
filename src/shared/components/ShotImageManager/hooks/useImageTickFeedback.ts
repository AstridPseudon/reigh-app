import { useEffect, useState } from 'react';

export function useImageTickFeedback() {
  const [showTickForImageId, setShowTickForImageId] = useState<string | null>(null);
  const [showTickForSecondaryImageId, setShowTickForSecondaryImageId] = useState<string | null>(null);

  useEffect(() => {
    if (!showTickForImageId) return;
    const timer = setTimeout(() => setShowTickForImageId(null), 3000);
    return () => clearTimeout(timer);
  }, [showTickForImageId]);

  useEffect(() => {
    if (!showTickForSecondaryImageId) return;
    const timer = setTimeout(() => setShowTickForSecondaryImageId(null), 3000);
    return () => clearTimeout(timer);
  }, [showTickForSecondaryImageId]);

  return {
    showTickForImageId,
    setShowTickForImageId,
    showTickForSecondaryImageId,
    setShowTickForSecondaryImageId,
  };
}
