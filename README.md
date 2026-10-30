# Painel de Extensões de Rede R4

Painel web da **Regional R4 – Interior (RJ)** para acompanhar a rede de água cadastrada, as extensões e melhorias validadas, a carteira de projetos desenhados no Google Earth e a qualidade do cadastro.

Ele responde à decisão principal da gerência: **quais extensões priorizar e o que precisa ser resolvido antes de aprovar cada uma.**

- Site: `https://comercialadrclaude-adr.github.io/portifolio/` (depois de ativar o GitHub Pages, ver abaixo)
- Decisões de projeto: [`docs/DECISOES.md`](docs/DECISOES.md)
- Dicionário de dados e definições das métricas: [`docs/DICIONARIO_DADOS.md`](docs/DICIONARIO_DADOS.md)

## Abas

| Aba | Para quem | O que mostra |
|---|---|---|
| Visão geral | Gerência | Frase-resumo, 5 KPIs, extensões por mês de cadastro no GIS, comparativo por município |
| Carteira de projetos | Equipe técnica | Funil de etapas, tabela de projetos, ficha com pendências e índice de prioridade, ZEIS, inventário dos KMZ |
| Mapa | Todos | Rede por tipo de obra e diâmetro, projetos, ZEIS, relevo, popups e régua |
| Qualidade do cadastro | Equipe técnica | Preenchimento por atributo e inconsistências com download em CSV |

O filtro de município e a aba ficam na URL (`?aba=mapa&municipio=Rio%20Bonito&projeto=P1`): um link compartilhado abre no mesmo ponto.

## Como rodar

Requisitos: Node 22 e Python 3.11+.

```bash
npm ci
pip install -r scripts/requirements.txt
```

Com os dados sintéticos de teste (não precisa dos KMZ):

```bash
npm run data:fixture
npm run dev:fixture
```

Abra `http://localhost:5173/portifolio/`. Uma faixa amarela avisa que os dados são sintéticos.

Com os dados reais sem publicá-los, gere a saída fora de `public/` e aponte o servidor para ela:

```bash
python scripts/build_dataset.py --modo completo --out .fixture/real
DATA_DIR=.fixture/real npm run dev
```

## Como atualizar os dados

**Pela pasta do OneDrive, direto no navegador (padrão):** no menu lateral, clique em **Atualizar dados** e depois em **Conectar pasta**; escolha a pasta do OneDrive que está sincronizada no seu computador (com os KMZ, em subpastas ou sem extensão). O painel lê os arquivos, roda o mesmo pipeline do Python (via Pyodide, dentro de um Web Worker) e passa a mostrar os dados da pasta. Não precisa de senha, de aplicativo no Azure nem de autorização da TI, e **nada é enviado a servidor algum**.

- Nas próximas vezes, **Atualizar da pasta** relê a pasta com um clique (o navegador pede para liberar a leitura de novo). Se nada mudou, avisa e não reprocessa.
- A pasta e o resultado ficam guardados neste navegador (IndexedDB). **Voltar aos dados publicados** apaga tudo.
- Em navegadores sem a API de pastas (Firefox, Safari, celular), use **Escolher pasta** ou **Importar arquivos**; funciona igual, só não lembra a pasta.
- Na primeira leitura o navegador baixa cerca de 20 MB (Python, numpy, shapely, pyproj e lxml, do jsDelivr) e guarda para as próximas. Com a base inteira (5.480 trechos, 12 arquivos) o cálculo leva por volta de 20 s em um computador comum.
- Os dados da pasta incluem a rede trecho a trecho (mapa e CSV de inconsistências), que o site publicado não traz. Eles ficam só no navegador de quem leu a pasta; as outras pessoas continuam vendo os dados publicados, a menos que leiam a pasta também.
- Se um arquivo estiver só na nuvem (OneDrive "Arquivos Sob Demanda"), o navegador o baixa ao ler; se falhar, marque **Sempre manter neste dispositivo**.

**Para atualizar o site publicado para todos**, gere os dados como abaixo e faça commit de `public/data/`. A [automação pelo GitHub com aplicativo do Azure](docs/ONEDRIVE.md) continua no repositório como alternativa, mas exige a TI.

**Pela linha de comando:**

1. Exporte a camada atualizada do GIS (ou os KMZ do Google Earth) para `data/raw/`. A pasta é ignorada pelo git, porque os arquivos brutos têm e-mails de funcionários e links internos. Os arquivos podem vir sem extensão: o pipeline identifica KMZ/KML pelo conteúdo. Se uma exportação nova ficar junto com cópias antigas da base, vale a de **edição mais recente** (`LAST_EDI_1`/`CREATED_DA`), mesmo que as antigas apareçam em mais arquivos; o `manifest.json` registra o aviso e o inventário marca as outras como "versão anterior". Projetos desenhados sobre uma cópia antiga continuam valendo.
2. Gere os dados:
   ```bash
   python scripts/build_dataset.py              # só agregados (padrão)
   python scripts/build_dataset.py --modo completo   # inclui a rede trecho a trecho
   ```
3. Confira:
   ```bash
   python -m pytest
   ```
   Os testes de `scripts/tests/test_referencia.py` comparam com os valores do escopo **só quando a base é a mesma do escopo** (`manifest.base_hash`). Com uma base atualizada eles aparecem como pulados (`skipped`): novas extensões mudam os totais e isso não é erro. Os demais testes (limpeza, regras, privacidade) continuam valendo. Veja também `public/data/manifest.json`: contagens, data dos dados (`dados_ate`), versão da base, avisos e materiais fora do padrão.
4. Faça commit de `public/data/`. O deploy publica sozinho a partir da `main`.

O pipeline **se recusa a gravar** qualquer saída que contenha e-mail, usuário do GIS (`CREATED_US`, `LAST_EDITE`) ou URL (SharePoint, Drive, `file:///`, qualquer `http`).

### Modo agregado × completo

| | Agregado (padrão) | Completo |
|---|---|---|
| Indicadores, projetos, ZEIS, relevo, inventário | sim | sim |
| `rede.geojson` (geometria dos 5.480 trechos) | não | sim |
| `trechos.json` (atributos limpos por trecho) | não | sim |
| Mapa da rede e CSV de trechos com inconsistência | não | sim |

O site publica **só os agregados** (decisão registrada em `docs/DECISOES.md`). Use o modo completo só se essa decisão mudar (ver [Privacidade](#privacidade)).

### Ficha dos projetos

Os campos que ainda não existem nos KMZ (solicitante, motivo, ligações previstas, custo, responsável, datas e etapa) ficam em `data/projetos_meta.json`, chaveados pelo nome do arquivo de origem. Campo `null` aparece como "a preencher". Esse arquivo é público: não coloque e-mails nem telefones.

## Como publicar (GitHub Pages)

1. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
2. Faça merge na `main`. O workflow `.github/workflows/deploy.yml` faz o build e publica.

O `base` do Vite é `/portifolio/`. A CI (`.github/workflows/ci.yml`) roda lint, pytest, Vitest, build e Playwright em todo PR.

## Privacidade

- `CREATED_US`, `LAST_EDITE`, `DESCRICAO`, `NOTAS` e os links nunca saem do pipeline: só campos de uma lista explícita são publicados.
- KMZ brutos ficam fora do git (`data/raw/`).
- Lendo a pasta no navegador, os KMZ são processados na memória do próprio navegador e descartados; só o resultado (que passa pelo mesmo bloqueio de e-mails, usuários e links) fica guardado, e só naquele navegador.
- O site do GitHub Pages é **público mesmo quando o repositório é privado** (exceto no GitHub Enterprise com controle de acesso). Tornar o repositório privado esconde o código, não o site. Se a base de rede não puder ser pública, publique no modo agregado.

## Testes

```bash
python -m pytest                     # pipeline (referência, sintético, privacidade)
DATA_DIR=.fixture/data npm test      # Vitest (formatação, métricas, prioridade, URL, CSV, pasta)
npm run build && npm run test:e2e    # Playwright (fumaça por aba, leitura da pasta; desktop e celular)
npm run lint                         # ESLint + Prettier
```

Os testes que rodam o Python **dentro do navegador** precisam de uma cópia local do Pyodide (o Node não carrega o Pyodide por URL):

```bash
npm run pyodide:local                                    # monta .pyodide/ (núcleo do npm + bibliotecas do jsDelivr)
PYODIDE_INDEX_URL=$PWD/.pyodide/ DATA_DIR=.fixture/data npm test   # Pyodide × pipeline nativo, byte a byte
PYODIDE_DIR=$PWD/.pyodide npm run test:e2e               # leitura da pasta no navegador
```

Sem essas variáveis, o teste do Pyodide é pulado e o e2e baixa o Pyodide do jsDelivr.

## Estrutura

```
data/raw/            KMZ originais (fora do git)
data/projetos_meta.json  ficha manual dos projetos
scripts/             pipeline Python (extract_kmz, limpeza, geo, quality, build_dataset)
scripts/navegador.py  entrada do pipeline dentro do navegador (Pyodide)
scripts/baixar_pyodide.mjs  cópia local do Pyodide para os testes
scripts/tests/       pytest + gerador de portfólio sintético
public/data/         saída do pipeline (o que o site lê)
src/app/             layout, estado/URL, carregamento de dados (publicados ou da pasta), tema
src/components/      ui/, charts/, map/
src/features/        visao-geral, carteira, mapa, qualidade
src/lib/             format, metrics, colors, priority, csv
src/lib/pasta/       leitura da pasta, worker e execução do pipeline no Pyodide
src/styles/tokens.css  cores (claro e escuro)
e2e/                 Playwright
```

## Próximo passo

Trocar a leitura de KMZ pela consulta direta ao FeatureServer do ArcGIS, agendada no GitHub Actions (por exemplo, semanal). A leitura está isolada em `scripts/extract_kmz.py → ler_fonte()`: basta outro leitor que devolva `Fonte`/`Feicao`.
