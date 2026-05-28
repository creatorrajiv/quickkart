import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/push';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker: enables PWA install + browser push notifications.
// Skipped on localhost in dev (Vite already complains), works on http://localhost
// and any HTTPS production host.
registerServiceWorker();
