import React from 'react';
import { HelpCircle, Copy } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';

interface GenerationHelpPopoverProps {
  isMobile: boolean;
  copiedAIInstructions: boolean;
  onCopyAIInstructions: () => void;
}

export const GenerationHelpPopover: React.FC<GenerationHelpPopoverProps> = ({
  isMobile,
  copiedAIInstructions,
  onCopyAIInstructions,
}) => {
  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="link" className="text-xs text-blue-600 hover:text-blue-800 p-1 h-auto touch-manipulation">
            <HelpCircle className="h-3 w-3 mr-1" />
            Need help?
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-sm">
          <div className="py-3 space-y-3">
            <p className="font-light">Troubleshooting steps:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Try running each line of the commands one-at-a-time</li>
              <li>Feed the command-line log into ChatGPT or your LLM of choice</li>
              <li>Drop into the <a href="https://discord.gg/WXrdkbkj" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">help channel</a> of the Reigh discord</li>
            </ol>
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCopyAIInstructions}
                className="text-xs min-h-[40px] touch-manipulation"
              >
                {copiedAIInstructions ? (
                  'Copied!'
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy instructions to get help from AI
                  </>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="link" className="text-xs text-blue-600 hover:text-blue-800 p-1 h-auto touch-manipulation">
          <HelpCircle className="h-3 w-3 mr-1" />
          Need help?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-sm">
        <div className="py-2 space-y-2">
          <p className="font-light text-sm">Troubleshooting steps:</p>
          <ol className="text-xs space-y-1 list-decimal list-inside">
            <li>Try running each line one-at-a-time</li>
            <li>Feed errors into ChatGPT or your LLM</li>
            <li>Join the <a href="https://discord.gg/WXrdkbkj" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Reigh discord</a></li>
          </ol>
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyAIInstructions}
              className="text-xs"
            >
              {copiedAIInstructions ? 'Copied!' : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy prompt for AI help
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
