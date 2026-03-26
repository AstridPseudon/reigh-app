import React from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { TimelineRenderer } from '@/tools/video-editor/compositions/TimelineRenderer';
import type { ResolvedTimelineConfig } from '@/tools/video-editor/types';

const compositionWidth = 1920;
const compositionHeight = 1080;

const makePatternSvgUrl = (): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <rect width="1600" height="900" fill="#111827" />
      <rect x="0" y="0" width="800" height="450" fill="#ef4444" />
      <rect x="800" y="0" width="800" height="450" fill="#22c55e" />
      <rect x="0" y="450" width="800" height="450" fill="#3b82f6" />
      <rect x="800" y="450" width="800" height="450" fill="#f59e0b" />
      <g fill="#ffffff" font-family="monospace" font-size="108" font-weight="700">
        <text x="110" y="170">TOP-LEFT</text>
        <text x="845" y="170">TOP-RIGHT</text>
        <text x="110" y="750">BOTTOM-LEFT</text>
        <text x="760" y="750">BOTTOM-RIGHT</text>
      </g>
      <g stroke="#ffffff" stroke-width="8" opacity="0.55">
        <line x1="800" y1="0" x2="800" y2="900" />
        <line x1="0" y1="450" x2="1600" y2="450" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const probeConfig: ResolvedTimelineConfig = {
  output: {
    resolution: `${compositionWidth}x${compositionHeight}`,
    fps: 30,
    file: 'probe.mp4',
  },
  tracks: [
    {
      id: 'V1',
      kind: 'visual',
      label: 'Probe Track',
    },
  ],
  registry: {
    probe: {
      file: 'probe.svg',
      type: 'image/svg+xml',
      src: makePatternSvgUrl(),
    },
  },
  clips: [
    {
      id: 'probe-clip',
      at: 0,
      track: 'V1',
      clipType: 'media',
      asset: 'probe',
      x: 658,
      y: 0,
      width: 2256,
      height: 1692,
      assetEntry: {
        file: 'probe.svg',
        type: 'image/svg+xml',
        src: makePatternSvgUrl(),
      },
    },
  ],
};

type SerializableElement = {
  tag: string;
  id: string | null;
  className: string | null;
  inlineStyle: string | null;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
  computed: Record<string, string>;
};

const round = (value: number): number => Math.round(value * 100) / 100;

const readElement = (element: Element | null): SerializableElement | null => {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const computed = getComputedStyle(element);

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    className: element.className ? String(element.className) : null,
    inlineStyle: element.getAttribute('style'),
    rect: {
      left: round(rect.left),
      top: round(rect.top),
      width: round(rect.width),
      height: round(rect.height),
      right: round(rect.right),
      bottom: round(rect.bottom),
    },
    computed: {
      position: computed.position,
      display: computed.display,
      overflow: computed.overflow,
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      width: computed.width,
      height: computed.height,
      left: computed.left,
      top: computed.top,
      transform: computed.transform,
      transformOrigin: computed.transformOrigin,
      marginLeft: computed.marginLeft,
      marginTop: computed.marginTop,
      justifyContent: computed.justifyContent,
      alignItems: computed.alignItems,
      backgroundColor: computed.backgroundColor,
      objectFit: computed.objectFit,
      clipPath: computed.clipPath,
      opacity: computed.opacity,
    },
  };
};

const App = () => {
  React.useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled) {
        return;
      }

      const playerShell = document.getElementById('player-shell');
      const playerRoot = playerShell?.firstElementChild as HTMLElement | null;
      const img = playerRoot?.querySelector('img') as HTMLImageElement | null;

      if (!playerShell || !playerRoot || !img) {
        requestAnimationFrame(measure);
        return;
      }

      const visualClipFill = img.parentElement;
      const ancestorChain: SerializableElement[] = [];
      let cursor: HTMLElement | null = visualClipFill instanceof HTMLElement ? visualClipFill : null;

      while (cursor) {
        const snapshot = readElement(cursor);
        if (snapshot) {
          ancestorChain.push(snapshot);
        }

        if (cursor === playerRoot) {
          break;
        }

        cursor = cursor.parentElement;
      }

      const allDivs = Array.from(playerRoot.querySelectorAll('div'));
      const scaledContainer = allDivs.find((div) => getComputedStyle(div).transform !== 'none') ?? null;
      const scaledOuter = scaledContainer?.parentElement ?? null;
      const timelineOuter = allDivs.find((div) => {
        const style = getComputedStyle(div);
        return style.backgroundColor === 'rgb(0, 0, 0)' && style.overflow === 'hidden';
      }) ?? null;
      const timelineCenter = allDivs.find((div) => {
        const style = getComputedStyle(div);
        return style.justifyContent === 'center' && style.alignItems === 'center';
      }) ?? null;
      const timelineRelative = allDivs.find((div) => {
        const style = getComputedStyle(div);
        return style.position === 'relative' && style.overflow === 'hidden';
      }) ?? null;

      const scaledOuterRect = scaledOuter?.getBoundingClientRect();
      const playerRootRect = playerRoot.getBoundingClientRect();
      const spillPoint = scaledOuterRect
        ? {
            x: round(Math.min(playerRootRect.right - 12, scaledOuterRect.right + 18)),
            y: round(scaledOuterRect.top + Math.min(120, Math.max(40, scaledOuterRect.height / 4))),
          }
        : null;
      const spillElements = spillPoint
        ? document.elementsFromPoint(spillPoint.x, spillPoint.y).slice(0, 5).map((element) => ({
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className: element.className ? String(element.className) : null,
          }))
        : [];

      const results = {
        composition: {
          width: compositionWidth,
          height: compositionHeight,
        },
        playerRoot: readElement(playerRoot),
        scaledOuter: readElement(scaledOuter),
        scaledContainer: readElement(scaledContainer),
        timelineOuter: readElement(timelineOuter),
        timelineCenter: readElement(timelineCenter),
        timelineRelative: readElement(timelineRelative),
        visualClipFill: readElement(visualClipFill),
        img: readElement(img),
        ancestorChain,
        spillTest: {
          point: spillPoint,
          elementsFromPoint: spillElements,
        },
        playerRootHtml: playerRoot.innerHTML.slice(0, 8000),
      };

      const output = document.getElementById('results');
      if (output) {
        output.textContent = JSON.stringify(results, null, 2);
      }

      document.body.dataset.probeReady = 'true';
    };

    requestAnimationFrame(() => requestAnimationFrame(measure));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gap: 24,
        gridTemplateColumns: '880px minmax(320px, 1fr)',
        padding: 24,
        boxSizing: 'border-box',
        background: '#111827',
      }}
    >
      <div
        style={{
          background: '#1f2937',
          padding: 16,
          borderRadius: 16,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        <div
          id="player-shell"
          style={{
            width: 880,
            height: 432,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 12,
            background:
              'linear-gradient(90deg, rgba(148,163,184,0.24) 0 56px, rgba(17,24,39,1) 56px calc(100% - 56px), rgba(148,163,184,0.24) calc(100% - 56px) 100%)',
          }}
        >
          <Player
            component={TimelineRenderer}
            inputProps={{ config: probeConfig }}
            durationInFrames={150}
            fps={30}
            compositionWidth={compositionWidth}
            compositionHeight={compositionHeight}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            showVolumeControls={false}
            acknowledgeRemotionLicense
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
      <pre
        id="results"
        style={{
          margin: 0,
          padding: 16,
          borderRadius: 16,
          background: '#020617',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
        }}
      >
        Waiting for Remotion probe…
      </pre>
    </div>
  );
};

createRoot(document.getElementById('app') as HTMLElement).render(<App />);
