import { Copy } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface CommandPreviewProps {
  command: string;
  copied: boolean;
  showFull: boolean;
  onCopy: () => void;
  onReveal: () => void;
  onHide: () => void;
  commandRef: React.RefObject<HTMLDivElement>;
}

export function CommandPreview({
  command,
  copied,
  showFull,
  onCopy,
  onReveal,
  onHide,
  commandRef,
}: CommandPreviewProps) {
  return (
    <div className="relative" ref={commandRef}>
      <div
        className={`bg-gray-900 text-green-400 p-3 pb-12 rounded-lg font-mono text-xs sm:text-sm overflow-hidden ${
          showFull ? 'overflow-x-auto' : ''
        }`}
        style={{ height: showFull ? 'auto' : '100px' }}
      >
        <pre className="whitespace-pre-wrap break-all text-xs sm:text-sm leading-relaxed">
          {command}
        </pre>
      </div>

      {!showFull && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent pointer-events-none rounded-b-lg" />
      )}

      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-center gap-2 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCopy}
          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white border-blue-500"
        >
          {copied ? (
            'Copied!'
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={showFull ? onHide : onReveal}
          className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600"
        >
          {showFull ? 'Hide' : 'Reveal'}
        </Button>
      </div>
    </div>
  );
}
