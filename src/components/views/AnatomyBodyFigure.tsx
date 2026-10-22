import React, { useEffect, useRef } from 'react';
import {
  BodyChart,
  FRONT_MUSCLES,
  ViewSide,
  getMuscleMetadata,
  type BodyState,
  type MuscleId,
} from '@emmorts/body-muscles';
import type { BodySegmentKey } from '../../types/health';
import { useTheme } from '../../context/ThemeContext';

interface AnatomyBodyFigureProps {
  activePart: BodySegmentKey;
  hoveredPart: BodySegmentKey | null;
  accentColor: string;
  onHoverPart: (part: BodySegmentKey | null) => void;
  onSelectPart: (part: BodySegmentKey) => void;
}

const PART_LABELS: Record<BodySegmentKey, string> = {
  trunk: '躯干',
  leftArm: '左臂',
  rightArm: '右臂',
  leftLeg: '左腿',
  rightLeg: '右腿',
};

const FALLBACK_REGION_LABELS: Partial<Record<MuscleId, string>> = {
  head: '头部',
  face: '面部',
  'neck-left': '左颈',
  'neck-right': '右颈',
};

const CALLOUT_POSITION: Record<BodySegmentKey, string> = {
  trunk: 'left-1/2 top-[29%] -translate-x-1/2',
  leftArm: 'right-0 top-[38%]',
  rightArm: 'left-0 top-[38%]',
  leftLeg: 'right-[5%] top-[67%]',
  rightLeg: 'left-[5%] top-[67%]',
};

const partForMuscle = (id: MuscleId): BodySegmentKey | null => {
  const metadata = getMuscleMetadata(id);
  if (!metadata) return null;

  const side = metadata.side === 'left' ? 'left' : 'right';

  if (metadata.group === 'Arms' || metadata.group === 'Shoulders') {
    return side === 'left' ? 'leftArm' : 'rightArm';
  }

  if (metadata.group === 'Chest' || metadata.group === 'Back' || metadata.group === 'Abdominals') {
    return 'trunk';
  }

  if (metadata.group === 'Legs') {
    return side === 'left' ? 'leftLeg' : 'rightLeg';
  }

  if (metadata.group === 'Hands & Feet') {
    if (id.startsWith('hand')) {
      return side === 'left' ? 'leftArm' : 'rightArm';
    }
    if (id.startsWith('foot')) {
      return side === 'left' ? 'leftLeg' : 'rightLeg';
    }
  }

  return null;
};

const REGION_PARTS = new Map<MuscleId, BodySegmentKey>(
  FRONT_MUSCLES.map((muscle) => [muscle.id, partForMuscle(muscle.id)])
    .filter((entry): entry is [MuscleId, BodySegmentKey] => entry[1] !== null)
);

const bodyStateForPart = (part: BodySegmentKey): BodyState => {
  const state: BodyState = {};

  REGION_PARTS.forEach((regionPart, id) => {
    if (regionPart === part) {
      state[id] = { intensity: 10, selected: true };
    }
  });

  return state;
};

const intensityColor = (intensity: number): string =>
  intensity > 0 ? 'var(--anatomy-accent)' : 'var(--anatomy-rest)';

export const AnatomyBodyFigure: React.FC<AnatomyBodyFigureProps> = ({
  activePart,
  hoveredPart,
  accentColor,
  onHoverPart,
  onSelectPart,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<BodyChart | null>(null);
  const activePartRef = useRef(activePart);
  const hoverCallbackRef = useRef(onHoverPart);
  const selectCallbackRef = useRef(onSelectPart);

  useEffect(() => {
    activePartRef.current = activePart;
  }, [activePart]);

  useEffect(() => {
    hoverCallbackRef.current = onHoverPart;
  }, [onHoverPart]);

  useEffect(() => {
    selectCallbackRef.current = onSelectPart;
  }, [onSelectPart]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = new BodyChart(container, {
      view: ViewSide.FRONT,
      bodyState: bodyStateForPart(activePartRef.current),
      onMuscleHover: (id) => {
        hoverCallbackRef.current(id ? REGION_PARTS.get(id) ?? null : null);
      },
      onMuscleClick: (id) => {
        const part = REGION_PARTS.get(id);
        if (part) selectCallbackRef.current(part);
      },
      showTooltip: false,
      showViewLabel: false,
      enableTransitions: true,
      intensityColor,
      ariaLabel: '可交互的人体正面五部位解剖图',
      labels: {
        chart: () => '人体正面五部位解剖图',
        regionName: (muscle) => {
          const part = REGION_PARTS.get(muscle.id);
          return part ? PART_LABELS[part] : FALLBACK_REGION_LABELS[muscle.id] ?? muscle.name;
        },
        region: (muscle) => {
          const part = REGION_PARTS.get(muscle.id);
          return part
            ? `${PART_LABELS[part]}解剖区域`
            : FALLBACK_REGION_LABELS[muscle.id] ?? muscle.name;
        },
      },
    });

    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.update({ bodyState: bodyStateForPart(activePart) });
  }, [activePart]);

  const anatomyStyle = {
    '--anatomy-accent': accentColor,
    '--anatomy-rest': isDark ? '#d8e1ec' : '#64748b',
    '--bm-padding': '0px',
    '--bm-max-height': '470px',
    '--bm-max-width': '285px',
    '--bm-background-opacity': isDark ? '0.11' : '0.08',
    '--bm-background-fill': 'var(--anatomy-rest)',
    '--bm-region-stroke': isDark ? '#020617' : '#334155',
    '--bm-region-stroke-width': '0.15',
    '--bm-region-stroke-selected': 'var(--anatomy-accent)',
    '--bm-region-stroke-width-selected': '0.34',
    '--bm-region-inactive-opacity': isDark ? '0.72' : '0.62',
    '--bm-region-active-shadow': 'drop-shadow(0 0 2.4px var(--anatomy-accent))',
    '--bm-svg-shadow': isDark
      ? 'drop-shadow(0 18px 28px rgba(0, 0, 0, 0.55))'
      : 'drop-shadow(0 18px 28px rgba(15, 23, 42, 0.18))',
    '--bm-transition-duration': '220ms',
  } as React.CSSProperties;

  return (
    <div
      className="anatomy-body-figure relative flex h-[470px] w-full items-center justify-center"
      style={anatomyStyle}
    >
      <div ref={containerRef} className="h-full w-full" />
      {hoveredPart && (
        <div
          className={`pointer-events-none absolute z-20 flex items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-neutral-950 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-neutral-950/95 dark:text-white ${CALLOUT_POSITION[hoveredPart]}`}
          aria-hidden="true"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          {PART_LABELS[hoveredPart]}
        </div>
      )}
    </div>
  );
};
