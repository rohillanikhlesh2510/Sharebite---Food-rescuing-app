import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/states/ErrorBoundary';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="ShareBite could not start">
      <App />
    </ErrorBoundary>
  </StrictMode>
);
