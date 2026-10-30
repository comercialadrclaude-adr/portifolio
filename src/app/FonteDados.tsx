import { Botao, Gaveta } from '@/components/ui';
import { fmtData, fmtDataHora } from '@/lib/format';
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Info,
  Loader2,
  RefreshCw,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { rotuloOrigem, suportaConexaoDePasta, useDadosLocais } from './dadosLocais';

const TITULO = 'fonte-dados-titulo';

// `webkitdirectory` (escolher uma pasta em navegadores sem a File System Access API) não está
// nos tipos do React.
const ATRIBUTOS_PASTA = { webkitdirectory: '' } as Record<string, string>;

/** Gaveta para ler a pasta dos KMZ (ou arquivos soltos) e atualizar o painel neste navegador. */
export function FonteDados({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const origem = useDadosLocais((s) => s.origem);
  const resumo = useDadosLocais((s) => s.resumo);
  const trabalho = useDadosLocais((s) => s.trabalho);
  const aviso = useDadosLocais((s) => s.aviso);
  const pastaLembrada = useDadosLocais((s) => s.pastaLembrada);
  const { conectarPasta, atualizarDaPasta, importarArquivos, voltarAosPublicados } =
    useDadosLocais.getState();

  const inputPasta = useRef<HTMLInputElement>(null);
  const inputArquivos = useRef<HTMLInputElement>(null);
  const lendo = trabalho.status === 'lendo';
  const comPastaDireta = suportaConexaoDePasta();

  const aoEscolher = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite escolher a mesma pasta de novo depois
    if (arquivos.length) void importarArquivos(arquivos);
  };

  return (
    <Gaveta aberta={aberta} onFechar={onFechar} rotuloId={TITULO}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 id={TITULO} className="text-lg font-semibold">
            Atualizar dados
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Leia a pasta do OneDrive com os KMZ do Google Earth.
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5 text-sm">
        <p>
          Escolha a pasta do OneDrive que está sincronizada <strong>neste computador</strong>. O
          painel lê os arquivos aqui no navegador e faz todos os cálculos localmente: nada é enviado
          a servidor algum, e não precisa de senha nem de autorização da TI.
        </p>

        {origem && (
          <section
            aria-label="Dados carregados"
            className="rounded-lg border border-border bg-surface-2 p-3"
          >
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} aria-hidden style={{ color: 'var(--ok)' }} />
              {rotuloOrigem(origem)}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
              <dt>Lida em</dt>
              <dd className="tabular text-text">{fmtDataHora(origem.lidoEm)}</dd>
              <dt>Arquivos</dt>
              <dd className="tabular text-text">{origem.arquivosLidos}</dd>
              {resumo?.dados_ate && (
                <>
                  <dt>Base até</dt>
                  <dd className="tabular text-text">{fmtData(resumo.dados_ate)}</dd>
                </>
              )}
              {resumo?.base_usada && (
                <>
                  <dt>Base usada</dt>
                  <dd className="break-all text-text">{resumo.base_usada}</dd>
                </>
              )}
            </dl>
            {resumo && resumo.avisos.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                {resumo.avisos.map((a) => (
                  <li key={a} className="flex gap-2">
                    <AlertTriangle
                      size={14}
                      aria-hidden
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--warn)' }}
                    />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {lendo && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 rounded-lg bg-tint-brand p-3"
          >
            <Loader2 size={16} aria-hidden className="mt-0.5 shrink-0 animate-spin" />
            <p>{trabalho.mensagem}</p>
          </div>
        )}
        {trabalho.status === 'erro' && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-tint-bad p-3">
            <AlertTriangle
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0"
              style={{ color: 'var(--bad)' }}
            />
            <p>{trabalho.mensagem}</p>
          </div>
        )}
        {aviso && !lendo && (
          <div role="status" className="flex items-start gap-2 rounded-lg bg-tint-brand p-3">
            <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
            <p>{aviso}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {comPastaDireta ? (
            pastaLembrada ? (
              <>
                <Botao
                  variante="primario"
                  disabled={lendo}
                  onClick={() => void atualizarDaPasta()}
                  icone={<RefreshCw size={14} aria-hidden />}
                >
                  Atualizar da pasta “{pastaLembrada}”
                </Botao>
                <Botao
                  disabled={lendo}
                  onClick={() => void conectarPasta()}
                  icone={<FolderOpen size={14} aria-hidden />}
                >
                  Trocar de pasta
                </Botao>
              </>
            ) : (
              <Botao
                variante="primario"
                disabled={lendo}
                onClick={() => void conectarPasta()}
                icone={<FolderOpen size={14} aria-hidden />}
              >
                Conectar pasta
              </Botao>
            )
          ) : (
            <Botao
              variante="primario"
              disabled={lendo}
              onClick={() => inputPasta.current?.click()}
              icone={<FolderOpen size={14} aria-hidden />}
            >
              Escolher pasta
            </Botao>
          )}
          <Botao
            disabled={lendo}
            onClick={() => inputArquivos.current?.click()}
            icone={<Upload size={14} aria-hidden />}
          >
            Importar arquivos
          </Botao>
          {origem && (
            <Botao
              variante="fantasma"
              disabled={lendo}
              onClick={() => void voltarAosPublicados()}
              icone={<Undo2 size={14} aria-hidden />}
            >
              Voltar aos dados publicados
            </Botao>
          )}
        </div>

        <input
          ref={inputPasta}
          type="file"
          multiple
          hidden
          aria-label="Escolher a pasta dos KMZ"
          data-testid="entrada-pasta"
          onChange={aoEscolher}
          {...ATRIBUTOS_PASTA}
        />
        <input
          ref={inputArquivos}
          type="file"
          multiple
          hidden
          aria-label="Importar arquivos KMZ ou KML"
          data-testid="entrada-arquivos"
          onChange={aoEscolher}
        />

        <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li>
            Os arquivos podem estar em subpastas e sem extensão, como o Google Earth exporta. Se
            houver várias versões da base, vale a de edição mais recente.
          </li>
          <li>
            Com a pasta lida, o painel mostra também a rede trecho a trecho (mapa e CSV de
            inconsistências), que o site publicado não traz. Esses dados ficam só neste navegador:
            outras pessoas continuam vendo os dados publicados, a menos que leiam a pasta também.
          </li>
          <li>
            Na primeira leitura o navegador baixa cerca de 20 MB (o Python que roda os cálculos) e
            guarda para as próximas. Leva de alguns segundos a poucos minutos.
          </li>
          {!comPastaDireta && (
            <li>
              Este navegador não deixa lembrar a pasta. No Chrome ou no Edge, o botão “Conectar
              pasta” guarda a pasta e atualiza com um clique.
            </li>
          )}
        </ul>
      </div>
    </Gaveta>
  );
}
