import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/legacyApp.css';
import App from './App.jsx';
import { LanguageProvider } from './i18n/index.jsx';
import LocalUiErrorBoundary from './common/LocalUiErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocalUiErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </LocalUiErrorBoundary>
  </StrictMode>
);
