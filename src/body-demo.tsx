import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import { CustomizationProvider } from './context/CustomizationContext';
import { BodyDemoView } from './components/views/BodyDemoView';
import './index.css';

if (!localStorage.getItem('apple_health_theme_mode')) {
  localStorage.setItem('apple_health_theme_mode', 'dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CustomizationProvider>
        <BodyDemoView />
      </CustomizationProvider>
    </ThemeProvider>
  </StrictMode>
);
