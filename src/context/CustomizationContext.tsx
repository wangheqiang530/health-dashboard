import React, { createContext, useContext, useState, useEffect } from 'react';

export type LiquidColorPreset = 'aurora' | 'sunset' | 'ocean' | 'emerald' | 'monochrome';

export interface LiquidBackgroundSettings {
  speedSeconds: number; // 8s to 60s
  blurPx: number; // 60px to 220px
  opacity: number; // 0.1 to 1.0
  preset: LiquidColorPreset;
  color1: string;
  color2: string;
  color3: string;
}

export interface LiquidGlassSettings {
  blurPx: number; // 10px to 60px
  opacity: number; // 0.4 to 0.95
  saturationPercent: number; // 120% to 260%
  specularGloss: number; // 0.1 to 0.8
  borderGlow: number; // 0.05 to 0.4
}

interface CustomizationContextType {
  liquid: LiquidBackgroundSettings;
  setLiquid: React.Dispatch<React.SetStateAction<LiquidBackgroundSettings>>;
  updateLiquid: (partial: Partial<LiquidBackgroundSettings>) => void;
  glass: LiquidGlassSettings;
  setGlass: React.Dispatch<React.SetStateAction<LiquidGlassSettings>>;
  updateGlass: (partial: Partial<LiquidGlassSettings>) => void;
  applyLiquidPreset: (preset: LiquidColorPreset) => void;
  resetCustomizationDefaults: () => void;
}

export const PRESET_COLORS: Record<LiquidColorPreset, { name: string; color1: string; color2: string; color3: string }> = {
  aurora: {
    name: 'Apple Aurora (极光霓虹)',
    color1: '#FA114F',
    color2: '#00F5D4',
    color3: '#6366F1',
  },
  sunset: {
    name: 'Sunset Glow (暮光晚霞)',
    color1: '#F43F5E',
    color2: '#F59E0B',
    color3: '#8B5CF6',
  },
  ocean: {
    name: 'Deep Ocean (深邃海洋)',
    color1: '#0284C7',
    color2: '#06B6D4',
    color3: '#3B82F6',
  },
  emerald: {
    name: 'Emerald Forest (青翠森林)',
    color1: '#10B981',
    color2: '#A1FF00',
    color3: '#059669',
  },
  monochrome: {
    name: 'Titanium Slate (钛金质感)',
    color1: '#94A3B8',
    color2: '#64748B',
    color3: '#CBD5E1',
  },
};

const DEFAULT_LIQUID: LiquidBackgroundSettings = {
  speedSeconds: 24,
  blurPx: 140,
  opacity: 0.75,
  preset: 'aurora',
  color1: '#FA114F',
  color2: '#00F5D4',
  color3: '#6366F1',
};

const DEFAULT_GLASS: LiquidGlassSettings = {
  blurPx: 38,
  opacity: 0.78,
  saturationPercent: 210,
  specularGloss: 0.35,
  borderGlow: 0.14,
};

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liquid, setLiquid] = useState<LiquidBackgroundSettings>(() => {
    try {
      const saved = localStorage.getItem('apple_health_liquid_v1');
      if (saved) return { ...DEFAULT_LIQUID, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_LIQUID;
  });

  const [glass, setGlass] = useState<LiquidGlassSettings>(() => {
    try {
      const saved = localStorage.getItem('apple_health_glass_v1');
      if (saved) return { ...DEFAULT_GLASS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_GLASS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('apple_health_liquid_v1', JSON.stringify(liquid));
    } catch {
      // ignore
    }
  }, [liquid]);

  useEffect(() => {
    try {
      localStorage.setItem('apple_health_glass_v1', JSON.stringify(glass));
    } catch {
      // ignore
    }
  }, [glass]);

  const updateLiquid = (partial: Partial<LiquidBackgroundSettings>) => {
    setLiquid((prev) => ({ ...prev, ...partial }));
  };

  const updateGlass = (partial: Partial<LiquidGlassSettings>) => {
    setGlass((prev) => ({ ...prev, ...partial }));
  };

  const applyLiquidPreset = (preset: LiquidColorPreset) => {
    const p = PRESET_COLORS[preset];
    if (p) {
      setLiquid((prev) => ({
        ...prev,
        preset,
        color1: p.color1,
        color2: p.color2,
        color3: p.color3,
      }));
    }
  };

  const resetCustomizationDefaults = () => {
    setLiquid(DEFAULT_LIQUID);
    setGlass(DEFAULT_GLASS);
  };

  return (
    <CustomizationContext.Provider
      value={{
        liquid,
        setLiquid,
        updateLiquid,
        glass,
        setGlass,
        updateGlass,
        applyLiquidPreset,
        resetCustomizationDefaults,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
};