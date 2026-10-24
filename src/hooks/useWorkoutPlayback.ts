import { useEffect, useRef, useState } from 'react';

const clampProgress = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const useWorkoutPlayback = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgressState] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      lastTimeRef.current = null;
      return;
    }

    const totalDurationMs = 42_000;
    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      setProgressState((previous) => {
        const next = previous + (delta / totalDurationMs) * playbackSpeed;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const seek = (value: number) => {
    setIsPlaying(false);
    setProgressState(clampProgress(value));
  };

  const togglePlayback = () => {
    if (progress >= 1) setProgressState(0);
    setIsPlaying((value) => !value);
  };

  const reset = () => {
    setIsPlaying(false);
    setProgressState(0);
  };

  return {
    isPlaying,
    progress,
    playbackSpeed,
    setPlaybackSpeed,
    setProgress: seek,
    togglePlayback,
    reset,
  };
};
