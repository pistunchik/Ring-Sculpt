import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { RouterProvider } from './router';
import { Root } from './Root';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <Root />
    </RouterProvider>
  </StrictMode>,
);
