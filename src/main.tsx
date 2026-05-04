import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('Elemento #app não encontrado em index.html');
}

ReactDOM.createRoot(container).render(<App />);
