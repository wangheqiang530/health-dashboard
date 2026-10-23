import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Layers3,
  Map as MapIcon,
  Minus,
  Moon,
  Navigation,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Satellite,
  Sun,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { GpxCoordinate, WorkoutRecord, WorkoutTelemetryPoint } from '../../types/health';

type MapMode = 'normal' | 'satellite' | 'terrain';
type MapTheme = 'dark' | 'light';

interface WorkoutAmapRouteProps {
  workout: WorkoutRecord;
  progress: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onProgressChange: (progress: number) => void;
  onTogglePlayback: () => void;
  onResetPlayback: () => void;
  onPlaybackSpeedChange: (speed: number) => void;
}

declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

let amapLoader: Promise<any> | null = null;

const loadAmap = (key: string, securityCode: string): Promise<any> => {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapLoader) return amapLoader;

  amapLoader = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: securityCode };
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.1Beta&key=${encodeURIComponent(key)}`;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        amapLoader = null;
        reject(new Error('高德地图脚本已加载，但 AMap 对象不可用。'));
      }
    };
    script.onerror = () => {
      amapLoader = null;
      script.remove();
      reject(new Error('高德地图加载失败，请检查网络或 Key 域名白名单。'));
    };
    document.head.appendChild(script);
  });

  return amapLoader;
};

const outOfChina = (lat: number, lng: number): boolean =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLat = (x: number, y: number): number => {
  let ret =
    -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
};

const transformLng = (x: number, y: number): number => {
  let ret =
    300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
};

const wgs84ToGcj02 = (lon: number, lat: number): [number, number] => {
  if (outOfChina(lat, lon)) return [lon, lat];
  const a = 6378245.0;
  const ee = 0.006693421622965943;
  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLng = transformLng(lon - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lon + dLng, lat + dLat];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatElapsed = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
};

const speedColor = (speed: number | null | undefined): string => {
  const ratio = clamp(((speed ?? 0) - 8) / 36, 0, 1);
  const green = [34, 197, 94];
  const yellow = [250, 204, 21];
  const red = [239, 68, 68];
  const from = ratio < 0.5 ? green : yellow;
  const to = ratio < 0.5 ? yellow : red;
  const localRatio = ratio < 0.5 ? ratio * 2 : (ratio - 0.5) * 2;
  const rgb = from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * localRatio)
  );
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const bearingBetween = (from: [number, number], to: [number, number]): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(from[1]);
  const lat2 = toRadians(to[1]);
  const deltaLng = toRadians(to[0] - from[0]);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const interpolatePosition = (
  points: Array<[number, number]>,
  progress: number
): [number, number] => {
  if (points.length === 0) return [0, 0];
  const exactIndex = clamp(progress, 0, 1) * (points.length - 1);
  const startIndex = Math.floor(exactIndex);
  const endIndex = Math.min(startIndex + 1, points.length - 1);
  const fraction = exactIndex - startIndex;
  const p0 = points[Math.max(0, startIndex - 1)];
  const p1 = points[startIndex];
  const p2 = points[endIndex];
  const p3 = points[Math.min(points.length - 1, endIndex + 1)];
  const t2 = fraction * fraction;
  const t3 = t2 * fraction;
  const cubic = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (-a + c) * fraction +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3);
  return [
    clamp(cubic(p0[0], p1[0], p2[0], p3[0]), Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])),
    clamp(cubic(p0[1], p1[1], p2[1], p3[1]), Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])),
  ];
};

export const WorkoutAmapRoute: React.FC<WorkoutAmapRouteProps> = ({
  workout,
  progress,
  isPlaying,
  playbackSpeed,
  onProgressChange,
  onTogglePlayback,
  onResetPlayback,
  onPlaybackSpeedChange,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const key = (import.meta.env.VITE_AMAP_KEY as string | undefined)?.trim();
  const securityCode = (
    import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
  )?.trim();
  const missingConfigMessage =
    !key || !securityCode
      ? '缺少 VITE_AMAP_KEY 或 VITE_AMAP_SECURITY_CODE，高德地图暂不可用。'
      : null;
  const [amap, setAmap] = useState<any>(null);
  const [mapMode, setMapMode] = useState<MapMode>('terrain');
  const [mapTheme, setMapTheme] = useState<MapTheme>(isDark ? 'dark' : 'light');
  const [followMode, setFollowMode] = useState(true);
  const [pitchAngle, setPitchAngle] = useState(58);
  const [yawOffset, setYawOffset] = useState(0);
  const [mapError, setMapError] = useState<string | null>(missingConfigMessage);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const playbackMarkerRef = useRef<any>(null);
  const progressRef = useRef(progress);
  const pitchAngleRef = useRef(pitchAngle);
  const followModeRef = useRef(followMode);
  const cameraProgressRef = useRef(progress);
  const smoothedHeadingRef = useRef<number | null>(null);
  const followInitializedRef = useRef(false);
  const viewPadRef = useRef<HTMLDivElement | null>(null);
  const draggingViewRef = useRef(false);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    pitchAngleRef.current = pitchAngle;
  }, [pitchAngle]);

  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);

  useEffect(() => {
    if (!key || !securityCode) return;
    loadAmap(key, securityCode)
      .then(setAmap)
      .catch((error: unknown) => {
        setMapError(error instanceof Error ? error.message : '高德地图初始化失败。');
      });
  }, [key, securityCode]);

  const routePoints = useMemo(
    () =>
      (workout.routeGpxPoints || []).filter(
        (point: GpxCoordinate) =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lon) &&
          Math.abs(point.lat) <= 90 &&
          Math.abs(point.lon) <= 180
      ),
    [workout.routeGpxPoints]
  );

  const telemetry = useMemo(
    () =>
      (workout.telemetry || []).filter(
        (point: WorkoutTelemetryPoint) =>
          Number.isFinite(point.elapsedSec) ||
          Number.isFinite(point.speedKmh) ||
          Number.isFinite(point.heartRate) ||
          Number.isFinite(point.power)
      ),
    [workout.telemetry]
  );

  const convertedPoints = useMemo(
    () =>
      routePoints.map((point) => {
        const [lng, lat] = wgs84ToGcj02(point.lon, point.lat);
        return [lng, lat] as [number, number];
      }),
    [routePoints]
  );

  const routeSpeeds = useMemo(
    () =>
      routePoints.map((point, index) => {
        if (Number.isFinite(point.speedKmh)) return Number(point.speedKmh);
        const telemetryIndex =
          routePoints.length <= 1
            ? 0
            : Math.round(
                (index / (routePoints.length - 1)) * Math.max(telemetry.length - 1, 0)
              );
        const matchedSpeed = telemetry[telemetryIndex]?.speedKmh;
        return Number.isFinite(matchedSpeed) ? Number(matchedSpeed) : null;
      }),
    [routePoints, telemetry]
  );

  useEffect(() => {
    if (!amap || !mapContainerRef.current || convertedPoints.length < 2) return;
    setMapReady(false);
    setMapError(null);

    let map: any;
    try {
      const satelliteLayers =
        mapMode === 'satellite'
          ? [new amap.TileLayer.Satellite(), new amap.TileLayer.RoadNet()]
          : undefined;
      map = new amap.Map(mapContainerRef.current, {
        zoom: 13,
        center: convertedPoints[0],
        resizeEnable: true,
        showLabel: true,
        mapStyle:
          mapTheme === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal',
        layers: satelliteLayers,
        viewMode: mapMode === 'terrain' ? '3D' : '2D',
        pitch: mapMode === 'terrain' ? pitchAngleRef.current : 0,
        terrain: mapMode === 'terrain',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '高德地图初始化失败。';
      window.setTimeout(() => setMapError(message), 0);
      return;
    }

    mapRef.current = map;
    try {
      map.addControl(new amap.Scale());
    } catch {
      // The scale control is optional.
    }

    const overlays: any[] = [
      new amap.Polyline({
        path: convertedPoints,
        strokeColor: '#07111f',
        strokeWeight: 9,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 45,
      }),
    ];
    const step = Math.max(1, Math.ceil((convertedPoints.length - 1) / 300));
    for (let index = 0; index < convertedPoints.length - 1; index += step) {
      const end = Math.min(convertedPoints.length - 1, index + step);
      overlays.push(
        new amap.Polyline({
          path: convertedPoints.slice(index, end + 1),
          strokeColor: speedColor(routeSpeeds[index]),
          strokeWeight: 5,
          strokeOpacity: 0.96,
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 50,
        })
      );
    }
    overlays.forEach((overlay) => map.add(overlay));

    const start = convertedPoints[0];
    const end = convertedPoints[convertedPoints.length - 1];
    map.add([
      new amap.Marker({
        position: start,
        content:
          '<div style="width:18px;height:18px;border-radius:50%;background:#34d399;border:3px solid #052e16;box-shadow:0 0 0 3px rgba(52,211,153,.25)"></div>',
        offset: new amap.Pixel(-9, -9),
        zIndex: 80,
      }),
      new amap.Marker({
        position: end,
        content:
          '<div style="width:18px;height:18px;border-radius:50%;background:#fb7185;border:3px solid #4c0519;box-shadow:0 0 0 3px rgba(251,113,133,.25)"></div>',
        offset: new amap.Pixel(-9, -9),
        zIndex: 80,
      }),
    ]);

    const playbackMarker = new amap.Marker({
      position: interpolatePosition(convertedPoints, progressRef.current),
      content:
        '<div style="width:22px;height:22px;border-radius:50%;background:#fff;border:4px solid #38bdf8;box-shadow:0 0 0 5px rgba(56,189,248,.24),0 0 18px rgba(56,189,248,.8)"></div>',
      offset: new amap.Pixel(-11, -11),
      zIndex: 100,
    });
    map.add(playbackMarker);
    playbackMarkerRef.current = playbackMarker;

    const lngs = convertedPoints.map((point) => point[0]);
    const lats = convertedPoints.map((point) => point[1]);
    const bounds = new amap.Bounds(
      new amap.LngLat(Math.min(...lngs), Math.min(...lats)),
      new amap.LngLat(Math.max(...lngs), Math.max(...lats))
    );
    if (followModeRef.current) {
      map.setZoom(16.2);
      map.setCenter(interpolatePosition(convertedPoints, progressRef.current), true);
    } else {
      map.setBounds(bounds, false, [50, 70, 50, 70]);
    }

    const readyTimer = window.setTimeout(() => setMapReady(true), 0);
    const resizeTimer = window.setTimeout(() => {
      map.resize?.();
    }, 180);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(resizeTimer);
      try {
        map.destroy();
      } catch {
        // The map may already have been destroyed during a mode switch.
      }
      mapRef.current = null;
      playbackMarkerRef.current = null;
    };
  }, [amap, convertedPoints, mapMode, mapTheme, routeSpeeds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || followMode || convertedPoints.length < 2) return;
    const lngs = convertedPoints.map((point) => point[0]);
    const lats = convertedPoints.map((point) => point[1]);
    const bounds = new amap.Bounds(
      new amap.LngLat(Math.min(...lngs), Math.min(...lats)),
      new amap.LngLat(Math.max(...lngs), Math.max(...lats))
    );
    map.setBounds(bounds, false, [50, 70, 50, 70]);
  }, [amap, convertedPoints, followMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !playbackMarkerRef.current || convertedPoints.length < 2) return;
    playbackMarkerRef.current.setPosition(interpolatePosition(convertedPoints, progress));
  }, [convertedPoints, mapReady, progress]);

  useEffect(() => {
    if (!followMode || !mapReady || !mapRef.current || convertedPoints.length < 2) return;
    let frame = 0;
    let lastCameraFrame = 0;

    const updateCamera = (timestamp: number) => {
      if (timestamp - lastCameraFrame >= 33) {
        lastCameraFrame = timestamp;
        cameraProgressRef.current +=
          (progressRef.current - cameraProgressRef.current) * 0.16;
        const currentProgress = cameraProgressRef.current;
        const current = interpolatePosition(convertedPoints, currentProgress);
        const lookAhead = interpolatePosition(
          convertedPoints,
          Math.min(1, currentProgress + 0.015)
        );
        try {
          if (!followInitializedRef.current) {
            mapRef.current.setZoom(16.2);
            followInitializedRef.current = true;
          }
          mapRef.current.setCenter(current, true);
          if (mapMode === 'terrain') {
            const targetHeading = bearingBetween(current, lookAhead);
            const previousHeading = smoothedHeadingRef.current ?? targetHeading;
            const rawHeadingDelta =
              ((targetHeading - previousHeading + 540) % 360) - 180;
            const headingDelta = clamp(rawHeadingDelta, -5, 5);
            const nextHeading =
              (previousHeading + headingDelta * 0.1 + 360) % 360;
            smoothedHeadingRef.current = nextHeading;
            mapRef.current.setPitch(pitchAngle, true);
            mapRef.current.setRotation(-(nextHeading + yawOffset), true);
          }
        } catch {
          // Keep the marker visible even if a camera transition is rejected.
        }
      }
      frame = requestAnimationFrame(updateCamera);
    };

    frame = requestAnimationFrame(updateCamera);
    return () => cancelAnimationFrame(frame);
  }, [convertedPoints, followMode, mapMode, mapReady, pitchAngle, yawOffset]);

  useEffect(() => {
    smoothedHeadingRef.current = null;
    followInitializedRef.current = false;
    cameraProgressRef.current = progressRef.current;
  }, [followMode, mapMode, mapTheme]);

  const applyViewAngles = (nextYaw: number, nextPitch: number) => {
    const normalizedYaw = clamp(Math.round(nextYaw), -180, 180);
    const normalizedPitch = clamp(Math.round(nextPitch), 0, 70);
    setYawOffset(normalizedYaw);
    setPitchAngle(normalizedPitch);

    const map = mapRef.current;
    if (!map) return;
    if (mapMode === 'terrain') map.setPitch?.(normalizedPitch, true);
    if (!followMode) map.setRotation?.(-normalizedYaw, true);
  };

  const updateViewFromPointer = (clientX: number, clientY: number) => {
    const pad = viewPadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    const y = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    applyViewAngles(x * 180, (1 - y) * 35);
  };

  const handleViewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingViewRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateViewFromPointer(event.clientX, event.clientY);
  };

  const handleViewPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingViewRef.current) return;
    updateViewFromPointer(event.clientX, event.clientY);
  };

  const handleViewPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingViewRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleViewKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 15 : 5;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      applyViewAngles(yawOffset - step, pitchAngle);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      applyViewAngles(yawOffset + step, pitchAngle);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      applyViewAngles(yawOffset, pitchAngle + step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      applyViewAngles(yawOffset, pitchAngle - step);
    }
  };

  const adjustZoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const currentZoom = Number(map.getZoom?.() ?? 14);
    map.setZoom(clamp(currentZoom + delta, 3, 19));
  };

  const totalDuration = Math.max(workout.durationMinutes * 60, 1);
  const normalizedProgress = clamp(progress, 0, 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#0b1220] shadow-2xl dark:border-white/10">
      <div className="relative h-[340px] overflow-hidden sm:h-[360px] lg:h-[370px]">
        <div
          ref={mapContainerRef}
          role="application"
          aria-label="高德地图骑行轨迹"
          className="absolute inset-0 h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/20" />

        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md border border-white/12 bg-slate-950/80 px-2.5 py-1.5 text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur-md">
            <MapIcon className="h-3.5 w-3.5 text-sky-300" />
            高德地图
            <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[8px] text-sky-200">
              {mapMode === 'terrain'
                ? '3D 轨迹'
                : mapMode === 'satellite'
                  ? '卫星'
                  : '2D 轨迹'}
            </span>
          </span>
          <span className="hidden rounded-md border border-white/10 bg-slate-950/72 px-2 py-1 text-[9px] text-slate-300 backdrop-blur-md sm:inline-flex">
            {routePoints.length.toLocaleString()} 轨迹点
          </span>
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <div className="flex rounded-md border border-white/12 bg-slate-950/82 p-0.5 shadow-lg backdrop-blur-md">
            {[
              { id: 'normal' as const, label: '普通', icon: MapIcon },
              { id: 'satellite' as const, label: '卫星', icon: Satellite },
              { id: 'terrain' as const, label: '地形', icon: Layers3 },
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setMapMode(mode.id)}
                  className={`flex h-8 items-center justify-center gap-1 rounded px-2 text-[10px] font-semibold transition ${
                    mapMode === mode.id
                      ? 'bg-sky-400/18 text-sky-200'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                  aria-label={`${mode.label}地图`}
                  title={`${mode.label}地图`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex rounded-md border border-white/12 bg-slate-950/82 p-0.5 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMapTheme('light')}
              className={`flex h-8 w-8 items-center justify-center rounded transition ${
                mapTheme === 'light'
                  ? 'bg-amber-300 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="日间地图"
              title="日间地图"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMapTheme('dark')}
              className={`flex h-8 w-8 items-center justify-center rounded transition ${
                mapTheme === 'dark'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="夜间地图"
              title="夜间地图"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-12 left-3 rounded-md border border-white/10 bg-slate-950/76 px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur-md">
          <span className="mr-1.5 font-semibold">轨迹速度</span>
          <span className="inline-block h-1.5 w-16 translate-y-[-1px] rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500" />
          <span className="ml-1.5">慢 → 快</span>
        </div>

        {mapMode === 'terrain' && (
          <div className="absolute right-3 top-[54px] hidden w-[108px] rounded-lg border border-white/12 bg-slate-950/82 p-2 shadow-xl backdrop-blur-md sm:block">
            <div className="mb-1.5 flex items-center justify-between px-0.5">
              <span className="text-[9px] font-semibold text-slate-400">视角球</span>
              <span className="font-mono text-[9px] text-sky-300">{pitchAngle}°</span>
            </div>
            <div
              ref={viewPadRef}
              role="application"
              tabIndex={0}
              aria-label="拖动调整地图旋转和俯仰"
              title="拖动调整旋转和俯仰，双击复位"
              onPointerDown={handleViewPointerDown}
              onPointerMove={handleViewPointerMove}
              onPointerUp={handleViewPointerUp}
              onPointerCancel={handleViewPointerUp}
              onDoubleClick={() => applyViewAngles(0, 58)}
              onKeyDown={handleViewKeyDown}
              className="relative h-20 w-full touch-none select-none overflow-hidden rounded-full border border-sky-300/25 bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,.14),rgba(15,23,42,.7))] shadow-inner outline-none focus:border-sky-300/60"
            >
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute inset-5 rounded-full border border-dashed border-white/10" />
              <div className="absolute left-1/2 top-1/2 h-px w-3/4 -translate-x-1/2 -translate-y-1/2 bg-white/10" />
              <div className="absolute left-1/2 top-1/2 h-3/4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/10" />
              <div
                className="pointer-events-none absolute h-7 w-7 rounded-full border-2 border-sky-100/90 bg-sky-400/85 shadow-[0_0_18px_rgba(56,189,248,.55)] transition-[left,top] duration-100"
                style={{
                  left: `${50 + (yawOffset / 180) * 38}%`,
                  top: `${88 - (pitchAngle / 70) * 76}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => adjustZoom(1)}
                className="flex h-7 items-center justify-center rounded bg-white/[0.06] text-slate-200 transition hover:bg-white/15"
                aria-label="放大地图"
                title="放大地图"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => adjustZoom(-1)}
                className="flex h-7 items-center justify-center rounded bg-white/[0.06] text-slate-200 transition hover:bg-white/15"
                aria-label="缩小地图"
                title="缩小地图"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {mapMode !== 'terrain' && (
          <div className="absolute right-3 top-[54px] flex gap-1 rounded-md border border-white/12 bg-slate-950/82 p-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => adjustZoom(1)}
              className="flex h-7 w-7 items-center justify-center rounded bg-white/[0.06] text-slate-200 transition hover:bg-white/15"
              aria-label="放大地图"
              title="放大地图"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(-1)}
              className="flex h-7 w-7 items-center justify-center rounded bg-white/[0.06] text-slate-200 transition hover:bg-white/15"
              aria-label="缩小地图"
              title="缩小地图"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1220]">
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/85 px-3 py-2 text-xs text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
              正在加载高德地图与轨迹
            </div>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1220]/95 p-5">
            <div className="max-w-sm rounded-lg border border-rose-400/20 bg-rose-950/30 p-4 text-center">
              <MapIcon className="mx-auto h-6 w-6 text-rose-300" />
              <p className="mt-2 text-sm font-semibold text-rose-100">高德地图暂不可用</p>
              <p className="mt-1 text-[11px] leading-relaxed text-rose-200/75">{mapError}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2.5 border-t border-white/10 bg-slate-950 px-3 py-3 text-slate-100 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlayback}
            className="flex h-9 min-w-[108px] items-center justify-center gap-1.5 rounded-md bg-sky-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-sky-300"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? '暂停回放' : normalizedProgress >= 1 ? '重新播放' : '播放轨迹'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!followMode) setYawOffset(0);
              setFollowMode((value) => !value);
            }}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[10px] font-semibold transition ${
              followMode
                ? 'border-sky-300/30 bg-sky-400/15 text-sky-200'
                : 'border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
            aria-label="切换跟随视角"
            title="跟随视角"
          >
            <Navigation className="h-3.5 w-3.5" />
            {followMode ? '跟随中' : '跟随'}
          </button>
          <button
            type="button"
            onClick={onResetPlayback}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="重置轨迹"
            title="重置轨迹"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <div className="flex rounded-md border border-white/10 bg-white/[0.05] p-0.5">
            {[0.5, 1, 2, 4].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onPlaybackSpeedChange(speed)}
                className={`h-8 min-w-8 rounded px-1.5 text-[9px] font-bold transition ${
                  playbackSpeed === speed
                    ? 'bg-white text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
                aria-label={`${speed} 倍回放速度`}
                title={`${speed} 倍回放速度`}
              >
                {speed}×
              </button>
            ))}
          </div>

          <span className="ml-auto font-mono text-[10px] text-slate-400">
            {formatElapsed(normalizedProgress * totalDuration)} / {formatElapsed(totalDuration)}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="1000"
          step="1"
          value={Math.round(normalizedProgress * 1000)}
          onChange={(event) => onProgressChange(Number(event.target.value) / 1000)}
          className="h-1.5 w-full cursor-pointer accent-sky-400"
          aria-label="拖动轨迹播放进度"
        />
        <div className="flex items-center justify-between gap-3 font-mono text-[9px] text-slate-500">
          <span>{Math.round(normalizedProgress * 100)}%</span>
          <span className="truncate">拖动进度或下方曲线，地图光点与四项遥测同步定位</span>
          <span>高德地图 · GCJ-02</span>
        </div>
      </div>
    </div>
  );
};
