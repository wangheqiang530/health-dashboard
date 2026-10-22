import { useState } from 'react';
import { Activity, Moon, Sun } from 'lucide-react';
import type {
  BodyMeasurement,
  BodySegmentKey,
  BodySegmentMeasurement,
} from '../../types/health';
import { useTheme } from '../../context/ThemeContext';
import { LiquidBackground } from '../ui/LiquidBackground';
import { BodySilhouette } from './BodySilhouette';

const segmentValues = (offset = 0): Record<BodySegmentKey, BodySegmentMeasurement> => ({
  trunk: {
    muscleKg: 27.4 + offset * 0.12,
    fatKg: 8.6 - offset * 0.08,
    impedance20kHz: 486.2 + offset * 2.6,
    impedance100kHz: 352.7 + offset * 1.8,
  },
  leftArm: {
    muscleKg: 3.7 + offset * 0.04,
    fatKg: 1.4 - offset * 0.02,
    impedance20kHz: 284.6 + offset * 1.4,
    impedance100kHz: 224.9 + offset * 0.9,
  },
  rightArm: {
    muscleKg: 3.8 + offset * 0.04,
    fatKg: 1.3 - offset * 0.02,
    impedance20kHz: 281.9 + offset * 1.3,
    impedance100kHz: 222.8 + offset * 0.8,
  },
  leftLeg: {
    muscleKg: 8.9 + offset * 0.08,
    fatKg: 3.2 - offset * 0.03,
    impedance20kHz: 245.7 + offset * 1.8,
    impedance100kHz: 196.4 + offset * 1.2,
  },
  rightLeg: {
    muscleKg: 9.0 + offset * 0.08,
    fatKg: 3.1 - offset * 0.03,
    impedance20kHz: 243.8 + offset * 1.7,
    impedance100kHz: 194.6 + offset * 1.1,
  },
});

const measurement = (date: string, offset = 0): BodyMeasurement => ({
  id: date,
  measuredAt: `${date}T08:30:00+08:00`,
  measuredDate: date,
  weightKg: 72.8 + offset * 0.12,
  bmi: 22.4,
  bodyFatPercent: 20.4 - offset * 0.08,
  skeletalMuscleKg: 33.5 + offset * 0.18,
  skeletalMusclePercent: 46.0,
  musclePercent: 46.0,
  leanMassKg: 57.9 + offset * 0.16,
  visceralFatLevel: 7,
  waterPercent: 58.2,
  boneMassKg: 3.2,
  bmrKcal: 1690,
  subcutaneousFatPercent: 17.8,
  proteinPercent: 18.6,
  bodyAge: 30,
  heartRate: 62,
  bodyScore: 82,
  smi: 9.1,
  whr: 0.86,
  segments: segmentValues(offset),
  segmentMuscleEstimated: false,
});

const measurements = [
  measurement('2026-10-15', 2),
  measurement('2026-10-18', 1),
  measurement('2026-10-21', 0),
];

export const BodyDemoView = () => {
  const { resolvedTheme, setThemeMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={`relative min-h-screen overflow-hidden transition-colors duration-500 ${
        isDark ? 'bg-[#060709] text-white' : 'bg-[#EAECEF] text-neutral-900'
      }`}
    >
      <LiquidBackground />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/25">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                  SVG Anatomy Demo
                </span>
                <span className="text-[10px] font-medium text-neutral-400">Sample data</span>
              </div>
              <h1 className="m-0 text-lg font-bold tracking-tight sm:text-xl">
                人体分段解剖 · 五部位高亮
              </h1>
            </div>
          </div>

          <div className="relative self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-neutral-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200 dark:hover:bg-white/[0.1]"
              aria-expanded={themeMenuOpen}
            >
              {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {isDark ? '深色样式' : '浅色样式'}
            </button>
            {themeMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 flex w-36 gap-1 rounded-xl border border-black/10 bg-white/95 p-1 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/95">
                <button
                  type="button"
                  onClick={() => {
                    setThemeMode('light');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                    !isDark
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Sun className="h-3 w-3" />
                  浅色
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setThemeMode('dark');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                    isDark
                      ? 'bg-white text-neutral-950'
                      : 'text-neutral-500 hover:text-neutral-950'
                  }`}
                >
                  <Moon className="h-3 w-3" />
                  深色
                </button>
              </div>
            )}
          </div>
        </header>

        <BodySilhouette measurement={measurements[2]} measurements={measurements} />
        <footer className="mt-3 flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-neutral-400">
          <span>Anatomy paths</span>
          <a
            href="https://github.com/emmorts/body-muscles"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-neutral-500 underline decoration-neutral-400/30 underline-offset-2 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-white"
          >
            @emmorts/body-muscles
          </a>
          <span>· Apache-2.0</span>
        </footer>
      </main>
    </div>
  );
};
