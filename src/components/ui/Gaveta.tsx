import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  aberta: boolean;
  onFechar: () => void;
  /** id do título do painel; ou use `rotulo` quando não houver título visível. */
  rotuloId?: string;
  rotulo?: string;
  lado?: 'direita' | 'esquerda';
  largura?: string;
  children: ReactNode;
}

/** Painel lateral sobreposto (dialog). Esc ou clique fora fecha; o foco volta para onde estava. */
export function Gaveta({
  aberta,
  onFechar,
  rotuloId,
  rotulo,
  lado = 'direita',
  largura = 'max-w-[440px]',
  children,
}: Props) {
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    painel.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [aberta, onFechar]);

  if (!aberta) return null;
  // Portal no <body>: o painel não herda margens nem empilhamento de quem o renderiza.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex ${lado === 'direita' ? 'justify-end' : 'justify-start'}`}
    >
      <div aria-hidden className="absolute inset-0 bg-text opacity-25" onClick={onFechar} />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={rotuloId}
        aria-label={rotuloId ? undefined : rotulo}
        tabIndex={-1}
        className={`relative h-full w-full ${largura} overflow-y-auto shadow-2xl outline-none ${
          lado === 'direita' ? 'gaveta border-l border-border bg-surface' : 'gaveta-esquerda'
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
