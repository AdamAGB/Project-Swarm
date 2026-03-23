import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { V4App } from './components/v4/V4App';
import { VizDemo } from './components/viz/VizDemo';
import { HomepageDemo } from './components/viz/HomepageDemo';
import { InputPageDemo } from './components/viz/InputPageDemo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<V4App />} />
        <Route path="/viz" element={<VizDemo />} />
        <Route path="/homepage" element={<HomepageDemo />} />
        <Route path="/input" element={<InputPageDemo />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
