import { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { cn } from '@/shared/components/ui/contracts/cn';
import type { AgentTurn } from '@/tools/video-editor/types/agent-session';
import type { ToolCallPair } from './AgentChat';

type AgentChatMessageProps = {
  turn: AgentTurn;
};

type AgentChatToolGroupProps = {
  pairs: ToolCallPair[];
};

function formatTimestamp(timestamp: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AgentChatToolGroup({ pairs }: AgentChatToolGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const count = pairs.length;

  // For run commands, show the command string directly
  const commandSummaries = pairs.map((p) => {
    const command = p.call.tool_args?.command;
    return typeof command === 'string' ? command : (p.call.content ?? p.call.tool_name ?? 'tool');
  });

  const label = count === 1
    ? commandSummaries[0]
    : `${count} commands`;

  return (
    <div className="w-full">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
        <code className="flex-1 truncate font-mono text-foreground/80">{label}</code>
        {count > 1 && (isOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />)}
      </button>

      {isOpen && count > 1 && (
        <div className="mt-1 space-y-0.5 pl-2">
          {pairs.map((pair, index) => (
            <div key={`${pair.call.timestamp}:${index}`} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
              <code className="font-mono text-foreground/70">{commandSummaries[index]}</code>
              {pair.result && (
                <span className="truncate text-muted-foreground">→ {pair.result.content?.slice(0, 80)}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Show result inline for single commands */}
      {count === 1 && pairs[0].result?.content && (
        <div className="mt-0.5 px-2.5 text-xs text-muted-foreground">
          {pairs[0].result.content.slice(0, 120)}
        </div>
      )}
    </div>
  );
}

export function AgentChatMessage({ turn }: AgentChatMessageProps) {
  const timestamp = formatTimestamp(turn.timestamp);
  const isUser = turn.role === 'user';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border/70 bg-card text-card-foreground',
        )}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{turn.content}</div>
        {timestamp && (
          <div
            className={cn(
              'mt-1.5 text-[10px] uppercase tracking-[0.14em]',
              isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
}
