import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// The service worker is registered by <UpdatePrompt />, which also owns the
// "新しいバージョンがあります" notice. Registering here as well would install
// a second updater that reloads without asking.

const root = document.getElementById('root');
if (!root) throw new Error('Application root was not found.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
