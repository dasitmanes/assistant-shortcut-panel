import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tdesign-react/es/style/index.css';
import { App } from './demo/App';
import './demo/demo.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
