/**
 * Handles database persistence for edit mode.
 * Saves/loads editMode to/from generations.params.ui.editMode
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EditMode } from './types';

const VALID_EDIT_MODES: EditMode[] = ['text', 'inpaint', 'annotate'];

export function useEditModePersistence() {
  /**
   * Load edit mode from database for a generation
   */
  const loadEditModeFromDB = useCallback(async (generationId: string): Promise<EditMode | null> => {
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('params')
        .eq('id', generationId)
        .maybeSingle();

      if (error) {
        console.warn('[EditMode] Failed to load edit mode from DB:', error);
        return null;
      }

      if (!data) {
        console.log('[EditMode] Generation not found (may have been deleted)');
        return null;
      }

      const savedMode = (data?.params as any)?.ui?.editMode;
      if (savedMode && VALID_EDIT_MODES.includes(savedMode)) {
        console.log('[EditMode] Loaded from DB:', { generationId: generationId.substring(0, 8), mode: savedMode });
        return savedMode as EditMode;
      }

      return null;
    } catch (err) {
      console.warn('[EditMode] Error loading from DB:', err);
      return null;
    }
  }, []);

  /**
   * Save edit mode to database for a generation
   */
  const saveEditModeToDB = useCallback(async (generationId: string, mode: EditMode) => {
    try {
      // First, fetch current params to merge
      const { data: current, error: fetchError } = await supabase
        .from('generations')
        .select('params')
        .eq('id', generationId)
        .maybeSingle();

      if (fetchError) {
        console.warn('[EditMode] Failed to fetch current params:', fetchError);
        return;
      }

      if (!current) {
        console.log('[EditMode] Generation not found (may have been deleted), skipping save');
        return;
      }

      // Merge with existing params
      const currentParams = (current?.params || {}) as Record<string, any>;
      const updatedParams = {
        ...currentParams,
        ui: {
          ...(currentParams.ui || {}),
          editMode: mode
        }
      };

      const { error: updateError } = await supabase
        .from('generations')
        .update({ params: updatedParams })
        .eq('id', generationId);

      if (updateError) {
        console.warn('[EditMode] Failed to save edit mode to DB:', updateError);
      } else {
        console.log('[EditMode] Saved to DB:', { generationId: generationId.substring(0, 8), mode });
      }
    } catch (err) {
      console.warn('[EditMode] Error saving to DB:', err);
    }
  }, []);

  return {
    loadEditModeFromDB,
    saveEditModeToDB,
  };
}
