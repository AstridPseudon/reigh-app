import React from 'react';
import { Play } from 'lucide-react';

interface PreviewSequencePillProps {
  adjacentVideoThumbnails: {
    prev?: { thumbUrl: string; pairIndex: number };
    current?: { thumbUrl: string; pairIndex: number };
    next?: { thumbUrl: string; pairIndex: number };
  };
  onOpenPreviewDialog: (startAtPairIndex: number) => void;
}

export const PreviewSequencePill: React.FC<PreviewSequencePillProps> = ({
  adjacentVideoThumbnails,
  onOpenPreviewDialog,
}) => {
  const { prev, current, next } = adjacentVideoThumbnails;

  const startIndex = prev?.pairIndex ?? current?.pairIndex ?? 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenPreviewDialog(startIndex);
      }}
      className="group relative flex items-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 hover:border-white/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden h-8 md:h-9"
      title="Preview sequence"
    >
      {/* Connected filmstrip — always 3 slots so pill stays centered */}
      <div className="flex items-center h-full">
        {prev ? (
          <img
            src={prev.thumbUrl}
            alt="Previous segment"
            className="h-full w-8 md:w-9 object-cover brightness-[0.5] group-hover:brightness-75 transition-all"
          />
        ) : (
          <div className="h-full w-8 md:w-9 bg-white/5" />
        )}
        {current && (
          <img
            src={current.thumbUrl}
            alt="Current segment"
            className="h-full w-8 md:w-9 object-cover brightness-90 transition-all"
          />
        )}
        {next ? (
          <img
            src={next.thumbUrl}
            alt="Next segment"
            className="h-full w-8 md:w-9 object-cover brightness-[0.5] group-hover:brightness-75 transition-all"
          />
        ) : (
          <div className="h-full w-8 md:w-9 bg-white/5" />
        )}
      </div>

      {/* Centered play icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-black/40 group-hover:bg-black/60 p-1 transition-colors">
          <Play className="w-3 h-3 text-white fill-white ml-px" />
        </div>
      </div>
    </button>
  );
};
