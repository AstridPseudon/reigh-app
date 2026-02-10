import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/shared/lib/errorHandler';
import { useOnboarding } from '@/shared/hooks/useOnboarding';
import { useUserUIState } from '@/shared/hooks/useUserUIState';
import { useProject } from '@/shared/contexts/ProjectContext';
import { useProductTour } from '@/shared/hooks/useProductTour';

export function useOnboardingFlow() {
  const { showOnboardingModal, closeOnboardingModal } = useOnboarding();
  const navigate = useNavigate();
  const { selectedProjectId } = useProject();
  const { startTour } = useProductTour();

  // Handle onboarding modal close - navigate to Getting Started shot, then start tour
  const handleOnboardingClose = useCallback(async () => {
    closeOnboardingModal();

    if (selectedProjectId) {
      try {
        const { data: shot } = await supabase
          .from('shots')
          .select('id')
          .eq('project_id', selectedProjectId)
          .eq('name', 'Getting Started')
          .maybeSingle();

        if (shot) {
          navigate(`/tools/travel-between-images?shot=${shot.id}`);
          setTimeout(() => {
            startTour();
          }, 1000);
        }
      } catch (err) {
        handleError(err, { context: 'Layout', showToast: false });
      }
    }
  }, [closeOnboardingModal, selectedProjectId, navigate, startTour]);

  // Preload user settings to warm the cache for the welcome modal
  useUserUIState('generationMethods', { onComputer: true, inCloud: true });

  // Preload ProductTour chunk when onboarding is shown
  useEffect(() => {
    if (showOnboardingModal) {
      import('@/shared/components/ProductTour').catch(() => {
        // Silently ignore preload failures - not critical
      });
    }
  }, [showOnboardingModal]);

  return {
    showOnboardingModal,
    handleOnboardingClose,
  };
}
