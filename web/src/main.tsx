import { createRoot } from 'react-dom/client';
import { AppProvider } from './lib/store';
import { App } from './App';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/admin.css';

createRoot(document.getElementById('root')!).render(<AppProvider><App /></AppProvider>);
