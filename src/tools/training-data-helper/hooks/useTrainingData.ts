import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/shared/lib/errorHandler';
import { useVideoUrlCache } from './useVideoUrlCache';
import { useTrainingDataBatches } from './useTrainingDataBatches';
import { useTrainingDataUpload } from './useTrainingDataUpload';
import { transformVideo, transformSegment } from './transforms';
import type { TrainingDataVideo, TrainingDataSegment } from './types';

// Re-export client types so existing consumers keep working
export type { TrainingDataBatch, TrainingDataVideo, TrainingDataSegment } from './types';

export function useTrainingData() {
  const [videos, setVideos] = useState<TrainingDataVideo[]>([]);
  const [segments, setSegments] = useState<TrainingDataSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Sub-hooks ---

  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    fetchBatches,
    createBatch,
    updateBatch,
    deleteBatch,
  } = useTrainingDataBatches({ videos });

  // --- Video & segment fetching ---

  const fetchVideos = async () => {
    try {
      let query = supabase
        .from('training_data')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedBatchId) {
        query = query.eq('batch_id', selectedBatchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVideos((data || []).map(transformVideo));
    } catch (error) {
      handleError(error, { context: 'useTrainingData.fetchVideos', toastTitle: 'Failed to load videos' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSegments = async () => {
    try {
      const { data, error } = await supabase
        .from('training_data_segments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSegments((data || []).map(transformSegment));
    } catch (error) {
      handleError(error, { context: 'useTrainingData.fetchSegments', toastTitle: 'Failed to load segments' });
    }
  };

  // --- Segment CRUD ---

  const createSegment = async (
    trainingDataId: string,
    startTime: number,
    endTime: number,
    description?: string,
  ): Promise<string> => {
    try {
      const { error: checkError } = await supabase
        .from('training_data')
        .select('id, batch_id')
        .eq('id', trainingDataId)
        .single();

      if (checkError) {
        console.error('[CreateSegment] Training data not found:', checkError);
        throw new Error(`Training data with ID ${trainingDataId} not found`);
      }

      const { data, error } = await supabase
        .from('training_data_segments')
        .insert({
          training_data_id: trainingDataId,
          start_time: Math.round(startTime),
          end_time: Math.round(endTime),
          description,
          metadata: { duration: Math.round(endTime - startTime) },
        })
        .select()
        .single();

      if (error) {
        console.error('[CreateSegment] Supabase error details:', {
          error, code: error.code, message: error.message,
          details: error.details, hint: error.hint,
        });
        throw error;
      }

      setSegments(prev => [transformSegment(data), ...prev]);
      return data.id;
    } catch (error) {
      console.error('[CreateSegment] Error creating segment:', error);
      throw error;
    }
  };

  const updateSegment = async (
    id: string,
    updates: Partial<{ startTime: number; endTime: number; description: string }>,
  ) => {
    try {
      const { data, error } = await supabase
        .from('training_data_segments')
        .update({
          start_time: updates.startTime ? Math.round(updates.startTime) : undefined,
          end_time: updates.endTime ? Math.round(updates.endTime) : undefined,
          description: updates.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setSegments(prev => prev.map(s => s.id === id ? transformSegment(data) : s));
    } catch (error) {
      handleError(error, { context: 'useTrainingData.updateSegment', toastTitle: 'Failed to update segment' });
    }
  };

  const deleteSegment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('training_data_segments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSegments(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      handleError(error, { context: 'useTrainingData.deleteSegment', toastTitle: 'Failed to delete segment' });
    }
  };

  // --- Video deletion ---

  const deleteVideo = async (id: string) => {
    try {
      const video = videos.find(v => v.id === id);
      if (!video) return;

      setVideos(prev => prev.filter(v => v.id !== id));
      setSegments(prev => prev.filter(s => s.trainingDataId !== id));
      clearUrlCache(id);

      const { error: dbError } = await supabase
        .from('training_data')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        await Promise.all([fetchVideos(), fetchSegments()]);
        throw dbError;
      }

      const { error: storageError } = await supabase.storage
        .from('training-data')
        .remove([video.storageLocation]);

      if (storageError) {
        console.warn('Storage deletion warning (file may already be deleted):', storageError);
      }
    } catch (error) {
      handleError(error, { context: 'useTrainingData.deleteVideo', toastTitle: 'Failed to delete video' });
    }
  };

  // --- Upload sub-hook ---

  const { isUploading, uploadVideo, uploadVideosWithSplitModes } = useTrainingDataUpload({
    selectedBatchId,
    videos,
    setVideos,
    createSegment,
    fetchVideos,
    fetchSegments,
  });

  // --- Video URL caching ---

  const { getVideoUrl, markVideoAsInvalid, clearUrlCache } = useVideoUrlCache(videos);

  // --- Effects ---

  useEffect(() => {
    fetchBatches();
    fetchSegments();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchVideos();
    }
  }, [selectedBatchId]);

  // --- Public API (unchanged) ---

  return {
    videos,
    segments,
    batches,
    selectedBatchId,
    isUploading,
    isLoading,
    uploadVideo,
    uploadVideosWithSplitModes,
    deleteVideo,
    createSegment,
    updateSegment,
    deleteSegment,
    getVideoUrl,
    markVideoAsInvalid,
    createBatch,
    updateBatch,
    deleteBatch,
    setSelectedBatchId,
  };
}
