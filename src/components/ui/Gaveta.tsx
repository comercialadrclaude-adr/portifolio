import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  aberta: boolean;
  onFechar: () => void;
  rotuloId: string;
  children: ReactNode;
}

/** Painel lateral sobreposto (dialog). Esc ou clique fora fecha; o foco volta para onde estava. */
export function Gaveta({ aberta, onFechar, rotuloId, children }: Props) {
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
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="absolute inset-0 bg-text opacity-25" onClick={onFechar} />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={rotuloId}
        tabIndex={-1}
        className="gaveta relative h-full w-full max-w-[440px] overflow-y-auto border-l border-border bg-surface shadow-2xl outline-none"
      >
        {children}
      </div>
    </div>
  );
}
