import { Select } from '@/components/ui';
import { fmtData } from '@/lib/format';
import type { Indicadores, Manifest } from '@/types/data';
import { Moon, Sun } from 'lucide-react';
import { useDados } from './data';
import { useApp } from './store';
import { useTema } from './theme';

export const TODOS = '';

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
    <header
      style={{ background: 'var(--header-bg)', color: 'var(--header-text)' }}
      className="border-b border-border"
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-6">
            Painel de Extensões de Rede R4
          </h1>
          <p className="truncate text-xs" style={{ color: 'var(--header-muted)' }}>
            Regional R4 – Interior (RJ)
            {dadosAte && <> · Dados até {fmtData(dadosAte)}</>}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select
            rotulo="Município"
            ocultarRotulo
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
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border"
            style={{ borderColor: 'color-mix(in srgb, var(--header-text) 30%, transparent)' }}
          >
            {tema === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  );
}
