import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { useDadosLocais } from './app/dadosLocais';
import './styles/index.css';

// Se há uma pasta lida antes, o painel já abre com os dados dela (sem piscar os publicados).
// O limite de tempo evita travar a abertura se o armazenamento do navegador demorar.
const limite = new Promise<void>((resolver) => setTimeout(resolver, 1500));
void Promise.race([useDadosLocais.getState().restaurar(), limite]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
