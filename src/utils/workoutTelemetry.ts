import type { ComponentType, CSSProperties } from 'react';
import { Activity, Gauge, Heart, Zap } from 'lucide-react';

export type TelemetryMetricKey = 'heartRate' | 'cadence' | 'power' | 'speedKmh';

export const TELEMETRY_METRICS: Array<{
  key: TelemetryMetricKey;
  label: string;
  unit: string;
  color: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
}> = [
  { key: 'heartRate', label: '心率', unit: 'bpm', color: '#F43F5E', icon: Heart },
  { key: 'cadence', label: '踏频', unit: 'rpm', color: '#22C55E', icon: Activity },
  { key: 'power', label: '功率', unit: 'W', color: '#F59E0B', icon: Zap },
  { key: 'speedKmh', label: '速度', unit: 'km/h', color: '#0EA5E9', icon: Gauge },
];
