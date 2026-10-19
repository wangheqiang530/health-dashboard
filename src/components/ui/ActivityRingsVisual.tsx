import React, { useEffect, useRef } from 'react';
import type { ActivityRings } from '../../types/health';
import { useTheme } from '../../context/ThemeContext';

export type ActivityRingKey = 'move' | 'exercise' | 'stand';

interface ActivityRingsVisualProps {
  rings: ActivityRings;
  size: number;
  highlightedRing?: ActivityRingKey | null;
  animate?: boolean;
  className?: string;
}

type Rgba = [number, number, number, number];
type RingProgress = [number, number, number];

const DARK_TRACKS: [Rgba, Rgba, Rgba] = [
  [0.196, 0.012, 0.063, 1],
  [0.133, 0.2, 0, 1],
  [0.016, 0.227, 0.212, 1],
];

const LIGHT_SHADOWS: [Rgba, Rgba, Rgba] = [
  [0.196, 0.012, 0.063, 0.9],
  [0.133, 0.2, 0, 0.9],
  [0.016, 0.227, 0.212, 0.9],
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInOutQuad = (x: number) =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeInOutQuart = (x: number) =>
  x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2;
const easeInOutQuint = (x: number) =>
  x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;

const toProgress = (ring: ActivityRings['move']): number => {
  if (!Number.isFinite(ring.current) || !Number.isFinite(ring.goal) || ring.goal <= 0) {
    return 0;
  }

  return Math.min(1.999, Math.max(0, ring.current / ring.goal));
};

const getProgress = (rings: ActivityRings): RingProgress => [
  toProgress(rings.move),
  toProgress(rings.exercise),
  toProgress(rings.stand),
];

const parseCssColor = (value: string, fallback: Rgba): Rgba => {
  const text = value.trim();
  const rgbaMatch = text.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );

  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return [
      Number(r) / 255,
      Number(g) / 255,
      Number(b) / 255,
      a === undefined ? 1 : Number(a),
    ];
  }

  const hex = text.replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16) / 255,
      parseInt(hex[1] + hex[1], 16) / 255,
      parseInt(hex[2] + hex[2], 16) / 255,
      1,
    ];
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ];
  }

  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
      parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }

  return fallback;
};

const vertexSource = `
  attribute vec2 aPosition;

  void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

// Core geometry, gradient stops and endpoint shadows are the parameters used by
// Apple's official close-your-rings hero. Track colors are theme-adaptable so the
// same visual can sit on both light and dark dashboard surfaces.
const fragmentSource = `
  precision highp float;

  #define red1 vec4(0.98, 0.067, 0.31, 1.0)
  #define red2 vec4(0.976, 0.22, 0.522, 1.0)
  #define green1 vec4(0.847, 1., 0., 1.0)
  #define green2 vec4(0.6, 1., 0.004, 1.0)
  #define blue1 vec4(0.008, 1., 0.659, 1.0)
  #define blue2 vec4(0., 0.847, 1., 1.0)
  #define PI 3.14593
  #define ringSize 0.449
  #define ringThickness 0.048
  #define spacingPct 0.16
  #define shadowSize 0.7
  #define shadowOpacity 0.5
  #define MAX_COMPLETE 0.99

  uniform vec2 resolution;
  uniform float moveProgress;
  uniform float moveOpacity;
  uniform float exerciseProgress;
  uniform float exerciseOpacity;
  uniform float standProgress;
  uniform float standOpacity;
  uniform vec4 moveTrack;
  uniform vec4 moveShadow;
  uniform vec4 exerciseTrack;
  uniform vec4 exerciseShadow;
  uniform vec4 standTrack;
  uniform vec4 standShadow;

  vec2 rotate(in vec2 coord, in float angle) {
    return coord * mat2(
      cos(angle), -sin(angle),
      sin(angle),  cos(angle)
    );
  }

  vec4 composite(in vec4 dst, in vec4 src, in float mask) {
    float alpha = src.a * mask;
    return vec4(src.rgb * alpha, alpha) + dst * (1.0 - alpha);
  }

  void main() {
    vec2 uv = gl_FragCoord.yx / resolution.xy;
    uv = 1. - uv;

    float sharpness = 2. / resolution.x;
    float invShadow = 1. - shadowOpacity;
    vec4 outputColor = vec4(0.);

    vec2 c = uv - 0.5;
    float dist = length(c);

    // Move ring
    float overage = max(0., moveProgress - 1.);
    float completeness = min(moveProgress, MAX_COMPLETE);
    c = rotate(c, -overage * PI);
    float angle = atan(c.y, c.x) / PI / 2. + 0.5;
    vec2 rc1 = vec2(-ringSize, 0.);
    vec2 rotC = rotate(c, completeness * PI * 2.);

    float startBall = smoothstep(
      0.,
      -sharpness,
      length(c - rc1) - ringThickness
    );
    rc1 = rotate(rc1, completeness * PI * 2.);

    float tipDist = length(c - rc1);
    float tipBall = smoothstep(0., -sharpness, tipDist - ringThickness);
    float percentColor = smoothstep(
      0.,
      1.,
      angle / max(completeness, 0.2)
    );

    vec4 gradientColor = mix(
      red1,
      red2,
      clamp(
        percentColor
          - startBall * step(c.x, -0.)
          + step(0.5, completeness) * 2. * tipBall * step(rotC.x, 0.1),
        0.,
        1.
      )
    );

    float balls = max(startBall, tipBall);
    rotC = rotate(c, -completeness * PI * 2.);
    float sideMask = step(-atan(rotC.y, rotC.x), 0.0);
    float tipShadow = invShadow + shadowOpacity * min(
      1.,
      smoothstep(
        ringThickness * 1.01,
        ringThickness / shadowSize,
        tipDist + sideMask
      )
        + smoothstep(
          ringThickness,
          ringThickness - sharpness,
          tipDist + sideMask
        )
    );

    float activeArc = max(
      smoothstep(0., sharpness, completeness - angle),
      balls
    );
    vec4 activeColor = mix(moveShadow, gradientColor, tipShadow);
    vec4 ringColor = mix(
      moveTrack,
      activeColor,
      moveOpacity * activeArc
    );
    float ringMask = smoothstep(
      ringThickness,
      ringThickness - sharpness,
      abs(dist - ringSize)
    );
    outputColor = composite(outputColor, ringColor, ringMask);

    // Exercise ring
    c = uv - 0.5;
    overage = max(0., exerciseProgress - 1.);
    completeness = min(exerciseProgress, MAX_COMPLETE);
    c = rotate(c, -overage * PI);
    rotC = rotate(c, completeness * PI * 2.);

    rc1 = vec2(
      -ringSize + ringThickness * (2. + spacingPct),
      0.
    );
    startBall = smoothstep(
      0.,
      -sharpness,
      length(c - rc1) - ringThickness
    );
    rc1 = rotate(rc1, completeness * PI * 2.);

    tipDist = length(c - rc1);
    tipBall = smoothstep(0., -sharpness, tipDist - ringThickness);
    angle = atan(c.y, c.x) / PI / 2. + 0.5;
    percentColor = smoothstep(
      0.,
      1.,
      angle / max(completeness, 0.2)
    );

    gradientColor = mix(
      green2,
      green1,
      clamp(
        percentColor
          - startBall * step(c.x, -0.)
          + step(0.5, completeness) * 2. * tipBall * step(rotC.x, 0.1),
        0.,
        1.
      )
    );

    balls = max(startBall, tipBall);
    rotC = rotate(c, -completeness * PI * 2.);
    sideMask = step(-atan(rotC.y, rotC.x), 0.0);
    tipShadow = invShadow + shadowOpacity * min(
      1.,
      smoothstep(
        ringThickness * 1.01,
        ringThickness / shadowSize,
        tipDist + sideMask
      )
        + smoothstep(
          ringThickness,
          ringThickness - sharpness,
          tipDist + sideMask
        )
    );

    activeArc = max(
      smoothstep(0., sharpness, completeness - angle),
      balls
    );
    activeColor = mix(exerciseShadow, gradientColor, tipShadow);
    ringColor = mix(
      exerciseTrack,
      activeColor,
      exerciseOpacity * activeArc
    );
    ringMask = smoothstep(
      ringThickness,
      ringThickness - sharpness,
      abs(dist - ringSize + ringThickness * (2. + spacingPct))
    );
    outputColor = composite(outputColor, ringColor, ringMask);

    // Stand ring
    c = uv - 0.5;
    overage = max(0., standProgress - 1.);
    completeness = min(standProgress, MAX_COMPLETE);
    c = rotate(c, -overage * PI);
    angle = atan(c.y, c.x) / PI / 2. + 0.5;

    rc1 = vec2(
      -ringSize + ringThickness * (4. + spacingPct * 2.),
      0.
    );
    rotC = rotate(c, completeness * PI * 2.);

    startBall = smoothstep(
      0.,
      -sharpness,
      length(c - rc1) - ringThickness
    );
    rc1 = rotate(rc1, completeness * PI * 2.);

    tipDist = length(c - rc1);
    tipBall = smoothstep(0., -sharpness, tipDist - ringThickness);
    percentColor = smoothstep(
      0.,
      1.,
      angle / max(completeness, 0.2)
    );

    if (uv.x > 0.5) {
      startBall *= completeness;
    }

    float mixValue = clamp(
      percentColor
        - startBall * step(c.x, -0.)
        + 2. * tipBall * step(rotC.x, 0.1),
      0.,
      1.
    );
    mixValue *= completeness;
    gradientColor = mix(blue2, blue1, mixValue);
    balls = max(startBall, tipBall);

    rotC = rotate(c, -completeness * PI * 2.);
    sideMask = step(-atan(rotC.y, rotC.x), 0.0);
    tipShadow = invShadow + shadowOpacity * min(
      1.,
      smoothstep(
        ringThickness * 1.01,
        ringThickness / shadowSize,
        tipDist + sideMask
      )
        + smoothstep(
          ringThickness,
          ringThickness - sharpness,
          tipDist + sideMask
        )
    );

    activeArc = max(
      smoothstep(0., sharpness, completeness - angle),
      balls
    );
    activeColor = mix(standShadow, gradientColor, tipShadow);
    ringColor = mix(
      standTrack,
      activeColor,
      standOpacity * activeArc
    );
    ringMask = smoothstep(
      ringThickness,
      ringThickness - sharpness,
      abs(dist - ringSize + ringThickness * (4. + spacingPct * 2.))
    );
    outputColor = composite(outputColor, ringColor, ringMask);

    gl_FragColor = outputColor;
  }
`;

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('无法创建 WebGL 着色器。');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || '着色器编译失败。';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
};

interface Renderer {
  resize: (size: number) => void;
  setTheme: (dark: boolean, rings: ActivityRings) => void;
  setProgress: (progress: RingProgress) => void;
  setHighlight: (ring: ActivityRingKey | null) => void;
  animateTo: (target: RingProgress, enabled: boolean) => void;
  draw: () => void;
  dispose: () => void;
}

const createRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });

  if (!gl) return null;

  const program = gl.createProgram();
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || '着色器链接失败。';
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(message);
  }

  gl.useProgram(program);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    resolution: uniform('resolution'),
    moveProgress: uniform('moveProgress'),
    moveOpacity: uniform('moveOpacity'),
    exerciseProgress: uniform('exerciseProgress'),
    exerciseOpacity: uniform('exerciseOpacity'),
    standProgress: uniform('standProgress'),
    standOpacity: uniform('standOpacity'),
    moveTrack: uniform('moveTrack'),
    moveShadow: uniform('moveShadow'),
    exerciseTrack: uniform('exerciseTrack'),
    exerciseShadow: uniform('exerciseShadow'),
    standTrack: uniform('standTrack'),
    standShadow: uniform('standShadow'),
  };

  let progress: RingProgress = [0, 0, 0];
  let highlight: ActivityRingKey | null = null;
  let frame = 0;
  let disposed = false;

  const draw = () => {
    if (disposed) return;

    const opacities: [number, number, number] = highlight
      ? [
          highlight === 'move' ? 1 : 0.16,
          highlight === 'exercise' ? 1 : 0.16,
          highlight === 'stand' ? 1 : 0.16,
        ]
      : [1, 1, 1];

    gl.uniform1f(uniforms.moveProgress, progress[0]);
    gl.uniform1f(uniforms.moveOpacity, opacities[0]);
    gl.uniform1f(uniforms.exerciseProgress, progress[1]);
    gl.uniform1f(uniforms.exerciseOpacity, opacities[1]);
    gl.uniform1f(uniforms.standProgress, progress[2]);
    gl.uniform1f(uniforms.standOpacity, opacities[2]);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return {
    resize: (size: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pixelSize = Math.max(1, Math.round(size * dpr));

      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
      }

      gl.viewport(0, 0, pixelSize, pixelSize);
      gl.uniform2f(uniforms.resolution, pixelSize, pixelSize);
      draw();
    },

    setTheme: (dark: boolean, rings: ActivityRings) => {
      const tracks: [Rgba, Rgba, Rgba] = dark
        ? DARK_TRACKS
        : [
            parseCssColor(rings.move.bgTrack, [0.98, 0.067, 0.31, 0.18]),
            parseCssColor(rings.exercise.bgTrack, [0.847, 1, 0, 0.18]),
            parseCssColor(rings.stand.bgTrack, [0.008, 1, 0.659, 0.18]),
          ];
      const shadows = dark ? DARK_TRACKS : LIGHT_SHADOWS;

      gl.uniform4fv(uniforms.moveTrack, tracks[0]);
      gl.uniform4fv(uniforms.exerciseTrack, tracks[1]);
      gl.uniform4fv(uniforms.standTrack, tracks[2]);
      gl.uniform4fv(uniforms.moveShadow, shadows[0]);
      gl.uniform4fv(uniforms.exerciseShadow, shadows[1]);
      gl.uniform4fv(uniforms.standShadow, shadows[2]);
      draw();
    },

    setProgress: (next: RingProgress) => {
      progress = next;
      draw();
    },

    setHighlight: (ring: ActivityRingKey | null) => {
      highlight = ring;
      draw();
    },

    animateTo: (target: RingProgress, enabled: boolean) => {
      cancelAnimationFrame(frame);

      if (!enabled) {
        progress = target;
        draw();
        return;
      }

      const start = performance.now();

      const tick = (now: number) => {
        const elapsed = now - start;
        const moveTime = clamp01(elapsed / 1800);
        const exerciseTime = clamp01(elapsed / 1800);
        const standTime = clamp01((elapsed - 100) / 1700);

        progress = [
          target[0] * easeInOutQuad(moveTime),
          target[1] * easeInOutQuart(exerciseTime),
          target[2] * easeInOutQuint(standTime),
        ];
        draw();

        if (elapsed < 1800 && !disposed) {
          frame = requestAnimationFrame(tick);
        } else {
          progress = target;
          draw();
        }
      };

      frame = requestAnimationFrame(tick);
    },

    draw,

    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
  };
};

export const ActivityRingsVisual: React.FC<ActivityRingsVisualProps> = ({
  rings,
  size,
  highlightedRing = null,
  animate = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const ringsRef = useRef(rings);
  const highlightRef = useRef(highlightedRing);
  const animateRef = useRef(animate);
  const themeRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    ringsRef.current = rings;
  }, [rings]);

  useEffect(() => {
    highlightRef.current = highlightedRing;
  }, [highlightedRing]);

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    themeRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: Renderer | null = null;

    try {
      renderer = createRenderer(canvas);
    } catch (error) {
      console.error('ActivityRingsVisual:', error);
      return;
    }

    if (!renderer) return;

    rendererRef.current = renderer;

    renderer.resize(size);
    renderer.setTheme(themeRef.current, ringsRef.current);
    renderer.setHighlight(highlightRef.current);
    renderer.animateTo(
      getProgress(ringsRef.current),
      animateRef.current &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    const handleResize = () => {
      renderer?.resize(size);
      renderer?.draw();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [size]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setTheme(isDark, rings);
  }, [isDark, rings]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    renderer.animateTo(getProgress(rings), animate && !reducedMotion);
  }, [animate, rings]);

  useEffect(() => {
    rendererRef.current?.setHighlight(highlightedRing);
  }, [highlightedRing]);

  const percent = (value: number, goal: number) =>
    goal > 0 ? Math.round((value / goal) * 100) : 0;

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`健身圆环：动态能量 ${percent(rings.move.current, rings.move.goal)}%，锻炼时间 ${percent(rings.exercise.current, rings.exercise.goal)}%，站立时间 ${percent(rings.stand.current, rings.stand.goal)}%。`}
      className={className}
      style={{ display: 'block', width: size, height: size, background: 'transparent' }}
    />
  );
};
