import { Key } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface GenerationTokenPanelProps {
  hasValidToken: boolean;
  isGenerating: boolean;
  onGenerateToken: () => void;
}

export function GenerationTokenPanel({
  hasValidToken,
  isGenerating,
  onGenerateToken,
}: GenerationTokenPanelProps) {
  if (hasValidToken) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Key className="h-5 w-5 text-blue-600" />
          <h4 className="font-light text-blue-900">
            To generate locally, you need an API key.
          </h4>
        </div>
        <Button
          onClick={onGenerateToken}
          disabled={isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isGenerating ? 'Generating...' : 'Generate Key & Show Instructions'}
        </Button>
      </div>
    </div>
  );
}
