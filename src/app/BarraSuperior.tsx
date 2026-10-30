import { Select } from '@/components/ui';
import type { Indicadores } from '@/types/data';
import { ChevronRight, Menu } from 'lucide-react';
import { useDados } from './data';
import { Marca } from './Marca';
import { ROTULO_ABA, useApp } from './store';

/** Barra do topo da área de conteúdo: trilha, filtro de município e (no celular) o menu. */
export function BarraSuperior({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const ind = useDados<Indicadores>('indicadores.json');
  const aba = useApp((s) => s.aba);
  const municipio = useApp((s) => s.municipio);
  const setMunicipio = useApp((s) => s.setMunicipio);

  const opcoes = [
    { valor: '', texto: 'Todos os municípios' },
    ...(ind.status === 'ok'
      ? ind.dados.municipios.map((m) => ({ valor: m.nome, texto: m.nome }))
      : []),
  ];
  // Município da URL que não existe nos dados continua visível para o usuário entender o filtro.
  if (municipio && !opcoes.some((o) => o.valor === municipio)) {
    opcoes.push({ valor: municipio, texto: `${municipio} (sem dados)` });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-page items-center gap-3 px-4 md:px-8">
        <button
          type="button"
          onClick={aoAbrirMenu}
          aria-label="Abrir menu"
          className="-ml-1 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text lg:hidden"
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="lg:hidden">
          <Marca tamanho={28} />
        </span>
        <nav aria-label="Trilha" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
          <span className="text-muted">Regional R4</span>
          <ChevronRight size={14} aria-hidden className="text-muted" />
          <span className="truncate font-medium">{ROTULO_ABA[aba]}</span>
        </nav>
        <div className="ml-auto w-full max-w-[16rem]">
          <Select
            rotulo="Município"
            ocultarRotulo
            icone
            value={municipio ?? ''}
            onChange={(e) => setMunicipio(e.target.value || null)}
            opcoes={opcoes}
          />
        </div>
      </div>
    </header>
  );
}
