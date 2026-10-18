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

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-all duration-700"
      style={{
        opacity: liquid.opacity,
        filter: `brightness(${liquid.brightness ?? 1})`,
      }}
    >
      {/* Dynamic Liquid Blob 1 (Primary Color) */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[800px] max-h-[800px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color1}40 0%, ${liquid.color3}25 50%, transparent 75%)`
            : `radial-gradient(circle, ${liquid.color1}35 0%, ${liquid.color3}20 50%, transparent 75%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-1 ${speed1} ease-in-out infinite`,
        }}
      />

      {/* Dynamic Liquid Blob 2 (Secondary Color) */}
      <div
        className="absolute top-[30%] -right-[15%] w-[52vw] h-[52vw] max-w-[720px] max-h-[720px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color2}35 0%, ${liquid.color1}20 50%, transparent 75%)`
            : `radial-gradient(circle, ${liquid.color2}30 0%, ${liquid.color1}18 50%, transparent 75%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-2 ${speed2} ease-in-out infinite`,
        }}
      />

      {/* Dynamic Liquid Blob 3 (Tertiary Color) */}
      <div
        className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] max-w-[850px] max-h-[850px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color3}35 0%, ${liquid.color2}20 50%, transparent 75%)`
            : `radial-gradient(circle, ${liquid.color3}30 0%, ${liquid.color2}18 50%, transparent 75%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-3 ${speed3} ease-in-out infinite`,
        }}
      />

      {/* Dynamic Liquid Blob 4 (Ambient Center Accent) */}
      <div
        className="absolute top-[18%] left-[42%] w-[38vw] h-[38vw] max-w-[520px] max-h-[520px] rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? `radial-gradient(circle, ${liquid.color1}25 0%, ${liquid.color2}15 60%, transparent 80%)`
            : `radial-gradient(circle, ${liquid.color1}20 0%, ${liquid.color2}15 60%, transparent 80%)`,
          filter: `blur(${blurStyle})`,
          animation: `liquid-drift-1 ${speed1} ease-in-out infinite reverse`,
        }}
      />
    </div>
  );
};
