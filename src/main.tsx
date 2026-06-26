import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA installation & offline caching support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${(import.meta as any).env?.BASE_URL || '/'}sw.js`;
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('ServiceWorker registered successfully with scope: ', registration.scope);
      })
      .catch((error) => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}


