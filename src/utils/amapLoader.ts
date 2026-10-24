declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

let amapLoader: Promise<any> | null = null;

export const loadAmap = (key: string, securityCode: string): Promise<any> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('高德地图只能在浏览器中加载。'));
  }
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapLoader) return amapLoader;

  amapLoader = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: securityCode };
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
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

export const preloadAmap = (): Promise<any> | null => {
  const key = (import.meta.env.VITE_AMAP_KEY as string | undefined)?.trim();
  const securityCode = (
    import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
  )?.trim();
  if (!key || !securityCode) return null;
  return loadAmap(key, securityCode);
};
