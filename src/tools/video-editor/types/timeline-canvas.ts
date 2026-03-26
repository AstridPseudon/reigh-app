export interface TimelineAction {
  id: string;
  start: number;
  end: number;
  effectId: string;
  selected?: boolean;
  flexible?: boolean;
  movable?: boolean;
  disable?: boolean;
  minStart?: number;
  maxEnd?: number;
}

export interface TimelineRow {
  id: string;
  actions: TimelineAction[];
  rowHeight?: number;
  selected?: boolean;
  classNames?: string[];
}

export interface TimelineEffectSourceParam {
  time: number;
  isPlaying: boolean;
  action: TimelineAction;
  effect: TimelineEffect;
  engine: any;
}

export interface TimelineEffectSource {
  start?: (param: TimelineEffectSourceParam) => void;
  enter?: (param: TimelineEffectSourceParam) => void;
  update?: (param: TimelineEffectSourceParam) => void;
  leave?: (param: TimelineEffectSourceParam) => void;
  stop?: (param: TimelineEffectSourceParam) => void;
}

export interface TimelineEffect {
  id: string;
  name?: string;
  source?: TimelineEffectSource;
}

export interface TimelineCanvasHandle {
  target: HTMLElement | null;
  listener: any;
  isPlaying: boolean;
  isPaused: boolean;
  setTime: (time: number) => void;
  getTime: () => number;
  setPlayRate: (rate: number) => void;
  getPlayRate: () => number;
  reRender: () => void;
  play: (param: {
    toTime?: number;
    autoEnd?: boolean;
    runActionIds?: string[];
  }) => boolean;
  pause: () => void;
  setScrollLeft: (value: number) => void;
  setScrollTop: (value: number) => void;
}
