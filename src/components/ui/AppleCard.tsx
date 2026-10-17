import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useCustomization } from '../../context/CustomizationContext';

interface AppleCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const AppleCard: React.FC<AppleCardProps> = ({
  children,
  className = '',
  onClick,
  hoverEffect = true,
}) => {
  const { resolvedTheme } = useTheme();
  const { glass } = useCustomization();
  const isDark = resolvedTheme === 'dark';

  // Dynamic Liquid Glass style overrides
  const liquidGlassStyle: React.CSSProperties = {
    backdropFilter: `blur(${glass.blurPx}px) saturate(${glass.saturationPercent}%)`,
    WebkitBackdropFilter: `blur(${glass.blurPx}px) saturate(${glass.saturationPercent}%)`,
    backgroundColor: isDark
      ? `rgba(15, 17, 26, ${glass.opacity})`
      : `rgba(255, 255, 255, ${glass.opacity})`,
    borderColor: isDark
      ? `rgba(255, 255, 255, ${glass.borderGlow})`
      : `rgba(0, 0, 0, ${glass.borderGlow * 0.6})`,
    boxShadow: isDark
      ? `0 24px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 1.5px 0 rgba(255, 255, 255, ${glass.specularGloss}), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.35)`
      : `0 16px 36px -10px rgba(15, 23, 42, 0.1), 0 4px 12px -2px rgba(15, 23, 42, 0.05), inset 0 1.5px 2px 0 rgba(255, 255, 255, ${Math.min(glass.specularGloss * 2.2, 1)})`,
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverEffect && onClick ? { y: -2, transition: { duration: 0.2 } } : undefined}
      style={liquidGlassStyle}
      className={`relative rounded-3xl p-5 md:p-6 transition-all duration-300 border ${
        isDark ? 'text-white' : 'text-neutral-900'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
};