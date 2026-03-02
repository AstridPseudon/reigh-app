import { useState, useEffect } from 'react';

/**
 * Returns true when a MediaLightbox is open (non-modal, desktop/tablet).
 * Reacts to the `lightbox-open` CSS class that LightboxShell toggles on <html>.
 */
export const useLightboxOpen = (): boolean => {
  const [isOpen, setIsOpen] = useState(
    () => document.documentElement.classList.contains('lightbox-open')
  );

  useEffect(() => {
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsOpen(html.classList.contains('lightbox-open'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isOpen;
};
