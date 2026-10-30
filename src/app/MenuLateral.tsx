import { fmtData, fmtDataHora, fmtInt } from '@/lib/format';
import type { Indicadores, Inconsistencia, Manifest } from '@/types/data';
import {
  Database,
  FolderKanban,
  LayoutDashboard,
  MapPinned,
  Moon,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useDados } from './data';
import { useDadosLocais } from './dadosLocais';
import { Marca } from './Marca';
import { useApp, type Aba } from './store';
import { useTema } from './theme';

const ITENS: { aba: Aba; Icone: LucideIcon; rotulo: string }[] = [
  { aba: 'visao-geral', Icone: LayoutDashboard, rotulo: 'Visão geral' },
  { aba: 'carteira', Icone: FolderKanban, rotulo: 'Carteira de projetos' },
  { aba: 'mapa', Icone: MapPinned, rotulo: 'Mapa' },
  { aba: 'qualidade', Icone: ShieldCheck, rotulo: 'Qualidade' },
];

/** Menu lateral escuro: marca, navegação entre as seções, data dos dados e tema. */
export function MenuLateral({
  aoNavegar,
  aoAtualizar,
}: {
  aoNavegar?: () => void;
  aoAtualizar: () => void;
}) {
  const aba = useApp((s) => s.aba);
  const setAba = useApp((s) => s.setAba);
  const manifest = useDados<Manifest>('manifest.json');
  const ind = useDados<Indicadores>('indicadores.json');
  const inc = useDados<Inconsistencia[]>('inconsistencias.json');
  const origem = useDadosLocais((s) => s.origem);
  const trabalho = useDadosLocais((s) => s.trabalho);
  const desatualizado = useDadosLocais((s) => s.desatualizado);
  const { tema, alternar } = useTema();

  const contagem: Partial<Record<Aba, number>> = {
    carteira: ind.status === 'ok' ? ind.dados.todos.projetos : undefined,
    qualidade:
      inc.status === 'ok'
        ? inc.dados.filter((i) => i.gravidade === 'Alta' && i.total > 0).length
        : undefined,
  };
  const dadosAte = manifest.status === 'ok' ? manifest.dados.dados_ate : null;
  const geradoEm = manifest.status === 'ok' ? manifest.dados.gerado_em : null;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="flex items-center gap-3 px-5 py-5">
        <Marca />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">Extensões de Rede</p>
          <p className="truncate text-xs text-sidebar-muted">Regional R4 – Interior (RJ)</p>
        </div>
      </div>

      <nav aria-label="Seções do painel" className="mt-2 flex-1 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
          Painel
        </p>
        <ul className="space-y-1">
          {ITENS.map(({ aba: a, Icone, rotulo }) => {
            const ativa = a === aba;
            const n = contagem[a];
            return (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => {
                    setAba(a);
                    aoNavegar?.();
                  }}
                  aria-current={ativa ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    ativa
                      ? 'bg-sidebar-active font-medium text-sidebar-text'
                      : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                  }`}
                >
                  {ativa && (
                    <span
                      aria-hidden
                      className="absolute -left-3 top-2 h-[calc(100%-16px)] w-1 rounded-r-full"
                      style={{ background: 'var(--net-extension)' }}
                    />
                  )}
                  <Icone size={18} aria-hidden className="shrink-0" />
                  <span className="flex-1 truncate text-left">{rotulo}</span>
                  {n != null && n > 0 && (
                    <span className="tabular rounded-full bg-sidebar-hover px-2 py-0.5 text-[11px] font-medium text-sidebar-text">
                      {fmtInt(n)}
                      <span className="sr-only">
                        {a === 'carteira' ? ' projetos' : ' problemas de gravidade alta'}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-hover p-3">
          <div className="flex items-center gap-2 text-xs text-sidebar-muted">
            <Database size={14} aria-hidden />
            {origem ? 'Dados da pasta' : 'Base cadastral do GIS'}
          </div>
          {origem && (
            <p className="mt-1 truncate text-sm font-semibold" title={origem.nome}>
              {origem.nome}
            </p>
          )}
          {dadosAte && (
            <p className={`${origem ? 'mt-0.5 text-xs text-sidebar-muted' : 'mt-1 text-sm'}`}>
              Dados até <span className="tabular font-semibold">{fmtData(dadosAte)}</span>
            </p>
          )}
          {origem ? (
            <p className="mt-0.5 text-xs text-sidebar-muted">
              Lida em {fmtDataHora(origem.lidoEm)}
            </p>
          ) : (
            geradoEm && (
              <p className="mt-0.5 text-xs text-sidebar-muted">Processado em {fmtData(geradoEm)}</p>
            )
          )}
          {trabalho.status === 'erro' && (
            <p role="status" className="mt-2 text-xs">
              A última leitura falhou. Abra “Atualizar dados” para ver o motivo.
            </p>
          )}
          {desatualizado && trabalho.status !== 'lendo' && (
            <p role="status" className="mt-2 text-xs">
              O painel foi atualizado: leia a pasta de novo.
            </p>
          )}
          <button
            type="button"
            onClick={aoAtualizar}
            title="Lê a pasta do OneDrive com os KMZ, aqui no navegador, e atualiza o painel."
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--net-extension)', color: 'var(--sidebar-bg)' }}
          >
            {trabalho.status === 'lendo' ? (
              <Loader2 size={14} aria-hidden className="animate-spin" />
            ) : (
              <RefreshCw size={14} aria-hidden />
            )}
            {trabalho.status === 'lendo' ? 'Lendo a pasta…' : 'Atualizar dados'}
          </button>
        </div>
        <button
          type="button"
          onClick={alternar}
          aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text"
        >
          {tema === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>
      </div>
    </div>
  );
}
