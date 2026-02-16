import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { TasksPane } from '@/shared/components/TasksPane/TasksPane';
import { ToolsPane } from '@/shared/components/ToolsPane/ToolsPane';
import { GenerationsPane } from '@/shared/components/GenerationsPane/GenerationsPane';
import { cn } from '@/shared/lib/utils';
import { usePanes } from '@/shared/contexts/PanesContext';
import { useContentResponsive } from '@/shared/hooks/useContentResponsive';
import { ReighLoading } from '@/shared/components/ReighLoading';
import SettingsModal from '@/shared/components/SettingsModal/SettingsModal';
import { useHeaderState } from '@/shared/contexts/ToolPageHeaderContext';
import { GlobalProcessingWarning } from '@/shared/components/ProcessingWarnings';
import { useCurrentShot } from '@/shared/contexts/CurrentShotContext';
import { OnboardingModal } from '@/shared/components/OnboardingModal';
import { ChunkLoadErrorBoundary } from '@/shared/components/ChunkLoadErrorBoundary';

// Lazy load ProductTour since it only shows during onboarding
const LazyProductTour = React.lazy(() =>
  import('@/shared/components/ProductTour').then(module => ({
    default: module.ProductTour
  }))
);
import '@/shared/lib/debugPolling';
import { AIInputModeProvider } from '@/shared/contexts/AIInputModeContext';
import { useIsMobile, useIsTablet } from '@/shared/hooks/use-mobile';
import { SocialIcons } from './components/SocialIcons';

import { useAuthGuard } from './hooks/useAuthGuard';
import { useSplitViewScroll } from './hooks/useSplitViewScroll';
import { useSettingsModal } from './hooks/useSettingsModal';
import { useOnboardingFlow } from './hooks/useOnboardingFlow';
import { TOOL_ROUTES } from '@/shared/lib/toolConstants';

// Scroll to top component
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Also dispatch event for custom scroll containers
    window.dispatchEvent(new CustomEvent('app:scrollToTop', { detail: { behavior: 'auto' } }));
  }, [pathname]);

  return null;
}

const Layout: React.FC = () => {
  const {
    isTasksPaneLocked,
    tasksPaneWidth,
    isShotsPaneLocked,
    shotsPaneWidth,
    isGenerationsPaneLocked,
    isGenerationsPaneOpen,
    generationsPaneHeight
  } = usePanes();
  const { header } = useHeaderState();
  const { setCurrentShotId } = useCurrentShot();
  const location = useLocation();

  // Mobile detection for split-view scroll handling
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isSmallMobile = isMobile && !isTablet;

  // On small mobile with locked generations pane, create split-view scroll behavior
  const isMobileSplitView = isSmallMobile && isGenerationsPaneLocked;

  // Extracted hooks
  const { splitViewWrapperRef } = useSplitViewScroll(isMobileSplitView);
  const { isSm, isMd, isLg, isXl, is2Xl, contentWidth, contentHeight } = useContentResponsive();
  const { session } = useAuthGuard();
  const { isSettingsModalOpen, setIsSettingsModalOpen, settingsInitialTab, settingsCreditsTab, handleOpenSettings } = useSettingsModal();
  const { showOnboardingModal, handleOnboardingClose } = useOnboardingFlow();

  // Reset currentShotId when navigating AWAY from shot-related pages
  // Don't clear when navigating TO travel-between-images (that's where shots are viewed)
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const isNavigatingToShotPage = location.pathname === TOOL_ROUTES.TRAVEL_BETWEEN_IMAGES;
    const wasOnShotPage = prevPathnameRef.current === TOOL_ROUTES.TRAVEL_BETWEEN_IMAGES;

    // Only clear if we're navigating AWAY from the shot page, not TO it
    if (!isNavigatingToShotPage && wasOnShotPage) {
      setCurrentShotId(null);
    }

    prevPathnameRef.current = location.pathname;
  }, [location.pathname, setCurrentShotId]);

  // Show loading spinner while determining auth state
  if (session === undefined) {
    return (
      <ReighLoading />
    );
  }

  // Redirect unauthenticated users to home page
  // Use /home instead of / to avoid redirect loops in non-WEB environments
  // where / is inside Layout
  if (!session) {
    return <Navigate to="/home" replace state={{ fromProtected: true }} />;
  }

  // Footer style matches main content margins for side panes
  const footerStyle = {
    marginRight: isTasksPaneLocked ? `${tasksPaneWidth}px` : '0px',
    marginLeft: isShotsPaneLocked ? `${shotsPaneWidth}px` : '0px',
    willChange: 'margin',
  } as React.CSSProperties;

  // Content-responsive container padding
  const containerPadding = isLg ? 'px-6' : isSm ? 'px-4' : 'px-2';
  // Reduce vertical padding on small screens to avoid excessive space above headers
  const containerSpacing = isLg ? 'py-1' : 'py-1';

  // Style for the scroll wrapper when in mobile split view
  // This wraps both header and content so they scroll together
  const splitViewWrapperStyle: React.CSSProperties = isMobileSplitView ? {
    height: `calc(100dvh - ${generationsPaneHeight}px)`,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  } : {};

  // When in split view, content doesn't need the scroll styles (wrapper handles it)
  const mainContentStyleWithoutScroll = {
    marginRight: isTasksPaneLocked ? `${tasksPaneWidth}px` : '0px',
    marginLeft: isShotsPaneLocked ? `${shotsPaneWidth}px` : '0px',
    paddingBottom: isMobileSplitView ? '0px' : ((isGenerationsPaneLocked || isGenerationsPaneOpen) ? `${generationsPaneHeight}px` : '0px'),
    '--content-width': `${contentWidth}px`,
    '--content-height': `${contentHeight}px`,
    '--content-sm': isSm ? '1' : '0',
    '--content-md': isMd ? '1' : '0',
    '--content-lg': isLg ? '1' : '0',
    '--content-xl': isXl ? '1' : '0',
    '--content-2xl': is2Xl ? '1' : '0',
    willChange: 'margin, padding',
  } as React.CSSProperties;

  // Render content - same structure, just conditionally wrapped
  const mainContent = (
    <>
      <GlobalHeader
        contentOffsetRight={isTasksPaneLocked ? tasksPaneWidth + 16 : 16}
        contentOffsetLeft={isShotsPaneLocked ? shotsPaneWidth : 0}
        onOpenSettings={handleOpenSettings}
      />

      <div
        className="relative z-10 transition-[margin,padding] duration-300 ease-smooth content-container"
        style={mainContentStyleWithoutScroll}
      >
        <GlobalProcessingWarning onOpenSettings={handleOpenSettings} />

        <main className={cn("container mx-auto", containerPadding, containerSpacing)}>
          {header}
          <Outlet />
        </main>
      </div>
    </>
  );

  return (
    <AIInputModeProvider>
      <div className="flex flex-col">
        <ScrollToTop />
        {/* Theme-adaptive background gradient - subtle in dark mode */}
        <div className="fixed inset-0 bg-gradient-to-br from-background via-secondary/10 to-accent/5 opacity-40 dark:opacity-0 pointer-events-none"></div>

        {/* When in mobile split view, wrap header + content in a scroll container */}
        {isMobileSplitView ? (
          <div ref={splitViewWrapperRef} style={splitViewWrapperStyle}>
            {mainContent}
          </div>
        ) : (
          mainContent
        )}

        <TasksPane onOpenSettings={handleOpenSettings} />
        <ToolsPane />
        <GenerationsPane />

        {/* Social Icons Footer */}
        <div
          className="relative transition-[margin] duration-300 ease-smooth"
          style={footerStyle}
        >
          <SocialIcons />
        </div>

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
          initialTab={settingsInitialTab}
          creditsTab={settingsCreditsTab}
        />

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={showOnboardingModal}
          onClose={handleOnboardingClose}
        />

        {/* Product Tour - lazy loaded since only needed during onboarding */}
        <ChunkLoadErrorBoundary>
          <React.Suspense fallback={null}>
            <LazyProductTour />
          </React.Suspense>
        </ChunkLoadErrorBoundary>
      </div>
    </AIInputModeProvider>
  );
};

export default Layout;
