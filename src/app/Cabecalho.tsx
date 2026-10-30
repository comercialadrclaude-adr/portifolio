import { Select } from '@/components/ui';
import { fmtData } from '@/lib/format';
import type { Indicadores, Manifest } from '@/types/data';
import { Moon, Sun } from 'lucide-react';
import { useDados } from './data';
import { useApp } from './store';
import { useTema } from './theme';

export const TODOS = '';

function Marca() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="7" fill="currentColor" opacity="0.14" />
      <path
        d="M7 21h7l4-10h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="11" r="2.8" fill="var(--net-extension)" />
    </svg>
  );
}

export function Cabecalho() {
  const manifest = useDados<Manifest>('manifest.json');
  const ind = useDados<Indicadores>('indicadores.json');
  const municipio = useApp((s) => s.municipio);
  const setMunicipio = useApp((s) => s.setMunicipio);
  const { tema, alternar } = useTema();

  const opcoes = [
    { valor: TODOS, texto: 'Todos os municípios' },
    ...(ind.status === 'ok'
      ? ind.dados.municipios.map((m) => ({ valor: m.nome, texto: m.nome }))
      : []),
  ];
  // Município da URL que não existe nos dados continua visível para o usuário entender o filtro.
  if (municipio && !opcoes.some((o) => o.valor === municipio)) {
    opcoes.push({ valor: municipio, texto: `${municipio} (sem dados)` });
  }
  const dadosAte = manifest.status === 'ok' ? manifest.dados.dados_ate : null;

  return (
    <header style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}>
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Marca />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-5 tracking-tight">
              Painel de Extensões de Rede
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--header-muted)' }}>
              Regional R4 – Interior (RJ)
              {dadosAte && <span className="lg:hidden"> · Dados até {fmtData(dadosAte)}</span>}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {dadosAte && (
            <p
              className="mr-2 hidden whitespace-nowrap text-xs lg:block"
              style={{ color: 'var(--header-muted)' }}
              title="Data da última edição na base cadastral (LAST_EDI_1)"
            >
              Dados até{' '}
              <span className="tabular font-medium" style={{ color: 'var(--header-text)' }}>
                {fmtData(dadosAte)}
              </span>
            </p>
          )}
          <Select
            rotulo="Município"
            ocultarRotulo
            variante="cabecalho"
            icone
            className="flex-1 sm:w-64 sm:flex-none"
            value={municipio ?? TODOS}
            onChange={(e) => setMunicipio(e.target.value || null)}
            opcoes={opcoes}
          />
          <button
            type="button"
            onClick={alternar}
            aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
            className="botao-cabecalho inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            {tema === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  );
}
