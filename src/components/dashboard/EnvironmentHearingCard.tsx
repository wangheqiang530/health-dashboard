import React from 'react';
import type { EnvironmentAndHearing } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Ear, Sun, Bike, Volume2, ShieldCheck } from 'lucide-react';

interface EnvironmentHearingCardProps {
  environment: EnvironmentAndHearing;
  cyclingDistanceKm: number;
}

export const EnvironmentHearingCard: React.FC<EnvironmentHearingCardProps> = ({
  environment,
  cyclingDistanceKm,
}) => {
  const hasAudioData =
    environment.environmentalAudioDb > 0 || environment.headphoneAudioDb > 0;

  return (
    <AppleCard className="overflow-hidden h-full flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0">
              <Ear className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                感官、环境与户外采光
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{hasAudioData ? environment.audioHealthStatus : '暂无环境数据'}</span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Environmental Audio Exposure */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                <span>环境音量</span>
              </div>
              <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">&lt; 70 dB 安全</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-neutral-900 dark:text-white">
                {environment.environmentalAudioDb > 0 ? environment.environmentalAudioDb : '—'}
              </span>
              <span className="text-xs text-neutral-400">dB</span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 block">
              {environment.environmentalAudioDb > 0 ? 'Apple Health 环境声级均值' : '等待环境声级数据'}
            </span>
          </div>

          {/* Headphone Audio Exposure */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <div className="flex items-center gap-1.5">
                <Ear className="w-3.5 h-3.5 text-indigo-400" />
                <span>耳机音量</span>
              </div>
              <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">
                {environment.headphoneAudioDb > 0 ? '已记录耳机声级' : '暂无数据'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-neutral-900 dark:text-white">
                {environment.headphoneAudioDb > 0 ? environment.headphoneAudioDb : '—'}
              </span>
              <span className="text-xs text-neutral-400">dB</span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 block">
              {environment.headphoneAudioDb > 0 ? 'Apple Health 耳机声级均值' : '等待耳机声级数据'}
            </span>
          </div>

          {/* Time in Daylight */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>日光下时间</span>
              </div>
              <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">
                {environment.timeInDaylightMin > 0 ? '已记录日光时间' : '暂无数据'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-neutral-900 dark:text-white">
                {environment.timeInDaylightMin > 0 ? environment.timeInDaylightMin : '—'}
              </span>
              <span className="text-xs text-neutral-400">分钟</span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 block">
              {environment.timeInDaylightMin > 0 ? 'Apple Health 日光暴露记录' : '等待日光数据'}
            </span>
          </div>

          {/* Cycling Daily Distance */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <div className="flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-[#00F5D4]" />
                <span>全天骑行总里程</span>
              </div>
              <span className="text-[10px] text-teal-500 dark:text-teal-400 font-semibold">日常通勤</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#00F5D4]">
                {cyclingDistanceKm !== undefined ? cyclingDistanceKm : 0}
              </span>
              <span className="text-xs text-neutral-400">km</span>
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 block">含训练及骑行代步</span>
          </div>
        </div>
      </div>
    </AppleCard>
  );
};
