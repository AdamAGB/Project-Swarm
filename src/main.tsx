import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { V4App } from './components/v4/V4App';
import { VizDemo } from './components/viz/VizDemo';
import { HomepageDemo } from './components/viz/HomepageDemo';
import { InputPageDemo } from './components/viz/InputPageDemo';
import { ColorDemo } from './components/viz/ColorDemo';
import { LightThemeDemo } from './components/viz/LightThemeDemo';
import { EffectsApp } from './components/effects/EffectsApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<V4App />} />
        <Route path="/effects" element={<EffectsApp />} />
        <Route path="/viz" element={<VizDemo />} />
        <Route path="/homepage" element={<HomepageDemo />} />
        <Route path="/input" element={<InputPageDemo />} />
        <Route path="/colors" element={<ColorDemo />} />
        <Route path="/light" element={<LightThemeDemo />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
