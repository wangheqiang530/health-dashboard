import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Scale, UserRound, X } from 'lucide-react';
import type { FitdaysProfile } from '../../api/healthApi';

interface FitdaysProfilePickerModalProps {
  isOpen: boolean;
  profiles: FitdaysProfile[];
  selectedSuid: string;
  onSelect: (suid: number) => void;
  onClose: () => void;
}

export const FitdaysProfilePickerModal: React.FC<FitdaysProfilePickerModalProps> = ({
  isOpen,
  profiles,
  selectedSuid,
  onSelect,
  onClose,
}) => {
  const [pendingSuid, setPendingSuid] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const selected = Number(selectedSuid);
    setPendingSuid(
      profiles.some((profile) => profile.suid === selected)
        ? selected
        : profiles.find((profile) => profile.isActive)?.suid || profiles[0]?.suid || null
    );
  }, [isOpen, profiles, selectedSuid]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="关闭档案选择"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="选择 Fitdays 档案"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="relative w-full max-w-lg rounded-3xl border border-black/10 bg-white/95 p-5 text-neutral-900 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-[#11141b]/95 dark:text-white"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-black/5 p-2 text-neutral-500 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">选择 Fitdays 档案</h3>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  只同步所选 SUID 的体测记录，账号下其他家庭成员不会混入。
                </p>
              </div>
            </div>

            <div className="mt-5 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {profiles.map((profile) => {
                const selected = pendingSuid === profile.suid;
                return (
                  <button
                    key={profile.suid}
                    type="button"
                    onClick={() => setPendingSuid(profile.suid)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-amber-500/45 bg-amber-500/10'
                        : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        selected
                          ? 'bg-amber-500 text-white'
                          : 'bg-black/5 text-neutral-500 dark:bg-white/10 dark:text-neutral-300'
                      }`}
                    >
                      {selected ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold">{profile.nickname}</span>
                        {profile.isActive && (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-300">
                            当前活跃档案
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-neutral-400">
                        <span>SUID {profile.suid}</span>
                        {profile.height && <span>身高 {profile.height} cm</span>}
                        {profile.birthday && <span>生日 {profile.birthday.slice(0, 10)}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-black/5 pt-4 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-xl px-3 text-xs font-semibold text-neutral-500 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                disabled={pendingSuid === null}
                onClick={() => {
                  if (pendingSuid === null) return;
                  onSelect(pendingSuid);
                  onClose();
                }}
                className="h-9 rounded-xl bg-amber-500 px-4 text-xs font-bold text-neutral-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                使用此档案
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
