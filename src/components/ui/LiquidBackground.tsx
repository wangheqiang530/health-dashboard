import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useCustomization } from '../../context/CustomizationContext';

export const LiquidBackground: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { liquid } = useCustomization();
  const isDark = resolvedTheme === 'dark';

  const speed1 = `${liquid.speedSeconds}s`;
  const speed2 = `${Math.round(liquid.speedSeconds * 1.15)}s`;
  const speed3 = `${Math.round(liquid.speedSeconds * 1.08)}s`;
  const blurStyle = `${liquid.blurPx}px`;

  // Compute dynamic alpha hex codes based on vibrancy (0.3 to 1.0)
  const vib = liquid.vibrancy ?? 0.85;
  const a1 = Math.round(vib * 190).toString(16).padStart(2, '0');
  const a2 = Math.round(vib * 125).toString(16).padStart(2, '0');
  const a3 = Math.round(vib * 75).toString(16).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-all duration-700"
      style={{
        opacity: liquid.opacity,
        filter: `brightness(${liquid.brightness ?? 1}) saturate(${liquid.saturation ?? 160}%) contrast(106%)`,
      }}
    >
      {/* Dynamic Liquid Blob 1 (Primary Color) */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[800px] max-h-[800px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color1}${a1} 0%, ${liquid.color3}${a2} 50%, transparent 80%)`
            : `radial-gradient(circle, ${liquid.color1}${a1} 0%, ${liquid.color3}${a2} 50%, transparent 80%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-1 ${speed1} ease-in-out infinite`,
        }}
      />

      {/* Dynamic Liquid Blob 2 (Secondary Color) */}
      <div
        className="absolute top-[30%] -right-[15%] w-[52vw] h-[52vw] max-w-[720px] max-h-[720px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color2}${a1} 0%, ${liquid.color1}${a2} 50%, transparent 80%)`
            : `radial-gradient(circle, ${liquid.color2}${a1} 0%, ${liquid.color1}${a2} 50%, transparent 80%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-2 ${speed2} ease-in-out infinite`,
        }}
      />

      {/* Dynamic Liquid Blob 3 (Tertiary Color) */}
      <div
        className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] max-w-[850px] max-h-[850px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color3}${a1} 0%, ${liquid.color2}${a2} 50%, transparent 80%)`
            : `radial-gradient(circle, ${liquid.color3}${a1} 0%, ${liquid.color2}${a2} 50%, transparent 80%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-3 ${speed3} ease-in-out infinite`,
        }}
      />

      {/* Dynamic Liquid Blob 4 (Ambient Center Accent) */}
      <div
        className="absolute top-[18%] left-[42%] w-[38vw] h-[38vw] max-w-[520px] max-h-[520px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color1}${a2} 0%, ${liquid.color2}${a3} 60%, transparent 82%)`
            : `radial-gradient(circle, ${liquid.color1}${a2} 0%, ${liquid.color2}${a3} 60%, transparent 82%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-1 ${speed1} ease-in-out infinite reverse`,
        }}
      />
    </div>
  );
};
