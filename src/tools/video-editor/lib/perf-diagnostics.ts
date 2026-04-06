type CounterState = { count: number; start: number; fired: boolean };
type RafState = CounterState & { last: number };

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
const logPerf = (message: string) => console.error(`[PERF] ${message}`);

const createWindowDetector = (
  label: string,
  threshold: number,
  windowMs: number,
) => {
  let states: Map<string, CounterState> | undefined;

  return {
    track(id: string) {
      const time = now();
      const map = states ?? (states = new Map());
      let state = map.get(id);
      if (!state) {
        map.set(id, { count: 1, start: time, fired: false });
        return;
      }
      if (time - state.start > windowMs) {
        state.count = 1;
        state.start = time;
        state.fired = false;
        return;
      }
      state.count += 1;
      if (!state.fired && state.count > threshold) {
        state.fired = true;
        logPerf(`${label}: ${id} exceeded ${threshold}/${windowMs}ms`);
      }
    },
  };
};

let rafStates: Map<string, RafState> | undefined;

export const RafLoopDetector = {
  track(id: string) {
    const time = now();
    const map = rafStates ?? (rafStates = new Map());
    let state = map.get(id);
    if (!state) {
      map.set(id, { count: 1, start: time, last: time, fired: false });
      return;
    }
    if (time - state.last > 1000 || time - state.start > 5000) {
      state.count = 1;
      state.start = time;
      state.last = time;
      state.fired = false;
      return;
    }
    state.count += 1;
    state.last = time;
    if (!state.fired && state.count > 1000) {
      state.fired = true;
      logPerf(`raf-loop: ${id} exceeded 1000 callbacks in 5s`);
    }
  },
};

export const RenderStormDetector = createWindowDetector('render-storm', 50, 1000);
export const EffectLoopDetector = createWindowDetector('effect-loop', 30, 1000);

type PerfWithMemory = Performance & { memory?: { usedJSHeapSize?: number } };

let memoryInterval: ReturnType<typeof setInterval> | undefined;
let lastHeap = 0;
let growthSamples = 0;
let memoryFired = false;

const sampleHeap = () => {
  if (typeof performance === 'undefined' || !('memory' in performance)) {
    return;
  }
  const usedHeap = (performance as PerfWithMemory).memory?.usedJSHeapSize;
  if (typeof usedHeap !== 'number') {
    return;
  }
  if (lastHeap === 0) {
    lastHeap = usedHeap;
    return;
  }
  if (usedHeap > lastHeap) {
    growthSamples += 1;
    if (!memoryFired && growthSamples >= 5) {
      memoryFired = true;
      logPerf(`memory-pressure: heap grew across ${growthSamples} samples`);
    }
  } else {
    growthSamples = 0;
    memoryFired = false;
  }
  lastHeap = usedHeap;
};

const startMemoryPressure = () => {
  if (memoryInterval !== undefined || typeof performance === 'undefined' || !('memory' in performance)) {
    return;
  }
  sampleHeap();
  memoryInterval = setInterval(sampleHeap, 30000);
};

const stopMemoryPressure = () => {
  if (memoryInterval !== undefined) {
    clearInterval(memoryInterval);
    memoryInterval = undefined;
  }
  lastHeap = 0;
  growthSamples = 0;
  memoryFired = false;
};

export const MemoryPressureDetector = {
  track(_id = 'video-editor') {
    startMemoryPressure();
  },
  start() {
    startMemoryPressure();
  },
  stop() {
    stopMemoryPressure();
  },
};
