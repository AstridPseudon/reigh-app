import type { PanePositionStrategy } from './PanePositionStrategy';
import { PanePosition } from '@/shared/config/panes';

export class BottomPanePositionStrategy implements PanePositionStrategy {
  getStyle(position: PanePosition): React.CSSProperties {
    const { dimension, offsets, isVisible } = position;
    const horizontalOffset = offsets.horizontal || 0;

    return {
      position: 'fixed',
      left: '50%',
      bottom: '0px',
      // Additional translateX accounts for asymmetrical side panes
      transform: `translateX(-50%) translateX(${horizontalOffset / 2}px) translateY(${isVisible ? -dimension : 0}px)`,
    };
  }
} 