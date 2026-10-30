# Decisões de projeto

Registro do que foi decidido, do que divergiu do escopo original e por quê.

## 1. Divergências encontradas entre o escopo e os dados

Os números de referência foram reproduzidos a partir dos 12 KMZ. Onde houve diferença, os dados reais prevalecem:

| Item do escopo | Escopo | Dados | Decisão |
|---|---|---|---|
| P1 "Extensão de Rede Prainha": distância da interligação à rede | ~140 m | **1,1 m** | O ponto de interligação está sobre uma adutora de 250 mm (trecho `T00134`, 8,3 km). Os 140,5 m são a distância até o **vértice** mais próximo dessa adutora, não até a linha. Adotada a distância até a linha, que é a definição da seção 8. |
| P1: traçado | 1.314 m | 1.315,7 m | Diferença de 0,1%: cálculo geodésico (GRS80). Mantido o geodésico. |
| ZEIS Rio Bonito | 18,2 · 10,0 · 12,1 ha | 18,25 · 10,04 · 12,16 ha | Dentro da tolerância de ±0,1. |
| `EXTENSAO` diverge do desenho | "às vezes" | 1 trecho com diferença > 5 m (12,7 m, 4,8%); nenhum > 20% | A regra fica ativa para dados futuros; hoje não há casos. A soma do desenho (1.198,226 km) bate com `EXTENSAO` (1.198,216 km), o que também valida o cálculo geodésico. |
| Arquivo de ZEIS | 11 pontos | 14 pontos | 11 sedes municipais + 3 pontos-rótulo dos polígonos (mesmo nome do polígono, descartados). |
| Nomes das ZEIS | — | Dois polígonos se chamam "ZEIS 2" (um com "Perimetro Ubano") | Publicados com IDs distintos (Z1–Z3). Corrigir os nomes no arquivo de origem. |
| Nome dos arquivos | "números" | Números **sem extensão** | O pipeline identifica KMZ/KML pelo conteúdo (assinatura zip + `.kml` interno). |
| `Shape__Len` | — | Em graus (ex.: 0,00027) | Descartado; o comprimento vem do cálculo geodésico. |

Achados nos dados que merecem atenção da equipe:

- **2 trechos cadastrados como chumbo** (150 mm, Miracema, classificados como melhoria validada). Provável erro de escolha no domínio do campo; virou a regra `material_chumbo`.
- O trecho de interligação do P1 (`T00134`, adutora de 250 mm) **não tem material**: aparece como pendência do projeto.
- Itaboraí tem 1 trecho de 9,4 km (adutora de 500 mm em ferro fundido); Carmo tem 4 trechos e Santo Antônio de Pádua tem 1. Vale confirmar se a atribuição de município está certa.

## 2. Privacidade

> **Decisão de 29/10/2026:** publicar **só os agregados**. `public/data/` foi gerado com o modo padrão (`python scripts/build_dataset.py`): sem `rede.geojson` nem `trechos.json` e sem a lista de ids por inconsistência. No site, o mapa mostra projetos, ZEIS e relevo; a aba Qualidade mostra contagens sem o CSV por trecho. Para mudar, gere com `--modo completo` e faça commit de `public/data/`.

- **Lista branca de campos.** Só os campos do dicionário são publicados. `CREATED_US`, `LAST_EDITE`, `DESCRICAO` e `NOTAS` nunca saem do pipeline (`NOTAS` tem números de OS; `DESCRICAO` tem 377 links de SharePoint, 26 de Drive e 71 `file:///`).
- **Bloqueio na gravação.** `build_dataset.py` se recusa a escrever se qualquer saída tiver e-mail, usuário do GIS ou URL. O mesmo é verificado no pytest, inclusive em `public/data/` versionado.
- **Modo agregado como padrão.** A base de rede trecho a trecho (`rede.geojson`, `trechos.json`) só é gerada com `--modo completo`. Até a decisão sobre publicar a base, nenhum dado processado foi commitado.
- **GitHub Pages é público** mesmo com o repositório privado (exceto no GitHub Enterprise com controle de acesso). Tornar o repositório privado não protege o site. Por isso a alternativa ao "pode publicar" é o modo agregado, não o repositório privado.
- **Dados sintéticos** para CI e testes de ponta a ponta (`scripts/tests/make_fixture.py`): coordenadas no oceano, municípios "Município A/B" e faixa "Dados sintéticos de teste" no painel. Nunca são copiados para `public/`.

## 3. Modelo de dados e regras

- **Tipos sem cor própria.** O escopo define cor só para rede existente, extensão e melhoria. Substituição (1 trecho), rede encontrada (15) e rede doada (13) aparecem com a cor da rede existente; o tipo exato está no popup e no CSV. Se a equipe quiser, Substituição pode passar para a cor de Melhoria.
- **Etapa do projeto não existe nos KMZ.** Fica em `data/projetos_meta.json`. Sem ela, a etapa é inferida (traçado → "Traçado preliminar"; só área → "Estudo") e marcada "a confirmar" na ficha e nas pendências.
- **IDs dos projetos** fixados em `data/projetos_meta.json` (P1 = Prainha, P2 = Rio Bonito – Centro, P3 = Rio dos Índios), para não mudarem quando chegarem novos KMZ.
- **Município e bairro do projeto**: os do trecho cadastrado mais próximo do centro do projeto.
- **Escolha da base**: as 5 cópias têm o mesmo hash de atributos + coordenadas. Usa-se uma cópia pura (sem projeto desenhado) como Referência; a outra pura vai para Arquivar. Quando houver versões diferentes, vence a de **edição mais recente**, não a mais repetida: os KMZ de projeto carregam cópias antigas da base, e uma exportação nova sozinha precisa ganhar delas.
- **Testes de referência** (seção 4) amarrados à versão da base (`manifest.base_hash`): com dados atualizados, os totais mudam e esses testes são pulados, em vez de falhar.
- **Pendências** geradas pelo pipeline: sem nome, sem ponto de interligação, sem traçado, interligação a mais de 50 m da rede, trecho de interligação sem material/diâmetro, etapa a confirmar e ficha incompleta.
- **Índice de prioridade calculado no front** (exceção ao "o pipeline calcula"): os pesos ficam em `src/lib/priority.ts` para a equipe ajustar sem rodar o pipeline. Critérios sem dado ficam de fora e o painel mostra quantos pontos de peso entraram no cálculo; não se inventa valor. Os mesmos dados estão no Vitest.
- **`gerado_em` idempotente**: só muda quando o conteúdo muda (hash no manifest), para não gerar commits vazios. O cabeçalho mostra `dados_ate` (última edição na base, `LAST_EDI_1`), que é mais útil que a hora de geração.

## 4. Front-end

- **Gráficos**: ECharts (`echarts/core`, só barras + SVG), para o gráfico mensal. Barras de preenchimento, barras dentro da célula e o funil são HTML/CSS (`role="meter"`), mais leves e acessíveis. O ECharts carrega sob demanda depois dos KPIs.
- **Mapa**: MapLibre 6 com Carto Positron/Dark Matter. Se o mapa base não carregar, entra um fundo liso e as camadas do painel continuam. A rede e o relevo vão por URL para o worker do MapLibre (sem interpretar o GeoJSON na thread principal). `trechos.json` só baixa depois que a rede está desenhada, porque só alimenta os popups.
- **Município filtrado no mapa**: os demais municípios ficam esmaecidos (18%), não somem, para manter o contexto.
- **Carteira → mapa**: clicar na linha abre a ficha lateral; o botão de mapa da linha (ou "Abrir no mapa" na ficha) leva ao mapa enquadrado no projeto.
- **Mini-mapa da ficha** em SVG (sem mapa base), com barra de escala: leve e sem uma segunda instância de WebGL.
- **URL**: troca de aba entra no histórico (botão voltar funciona); filtros substituem a entrada atual. Trocar de município fecha o projeto aberto.
- **CSV** com `;`, vírgula decimal e BOM UTF-8, para abrir direto no Excel em pt-BR.
- **Popups** montados com `textContent`, nunca HTML cru: nomes vêm do Google Earth.

### Revisão visual (30/10/2026)

- **Hierarquia**: cada aba abre com título de página (24 px), uma linha de contexto e o filtro de município ativo como chip removível. O nome do produto no cabeçalho ganhou marca gráfica, e a data dos dados fica no cabeçalho.
- **KPIs com referência visual**: medidores finos mostram a proporção da rede (extensões e melhorias) e a completude contra o mínimo de 50%. Os cards de rede e de projetos levam um link para a aba correspondente.
- **Gráfico de extensões**: começa no primeiro mês com extensão (antes, 18 meses vazios desde ago/2021) e alterna entre mensal, trimestral e acumulado, além de gráfico e tabela. Só o pico leva rótulo de valor. Um rodapé traz total, maior período e trechos sem data.
- **Rede por tipo de obra**: card novo ao lado do gráfico, com km e participação de cada tipo.
- **Carteira**: as etapas viram um fluxo contínuo e a ficha do projeto abre numa gaveta lateral (dialog, fecha com Esc e devolve o foco), sem esticar a tabela. O inventário vem ordenado pelo que pede ação: projetos, referências, arquivar, excluir.
- **Qualidade**: um resumo por gravidade (ocorrências e regras afetadas) abre a aba.
- **Gaveta e popovers** são os únicos elementos com sombra; animação só na entrada da gaveta (180 ms) e respeitando `prefers-reduced-motion`.

### Layout SaaS com menu lateral (30/10/2026)

A pedido do usuário, o visual deixou parte das regras de sobriedade do escopo (seção 7) para ficar com cara de produto:

- **Menu lateral escuro fixo** (`--sidebar-*`) com ícones, contadores (projetos; regras de gravidade alta) e a data da base; no celular abre como gaveta pelo botão de menu. Ele substitui as abas no topo.
- **Barra superior** com trilha ("Regional R4 › seção") e o filtro de município.
- **Cards** com raio de 12 px e sombra suave (`--shadow-card`), que antes só era permitida em popovers. KPIs e resumo por gravidade ganharam ícone num chip tingido com a cor do indicador.
- **Tabelas** com faixa de cabeçalho em `--surface-2`.
- **Gaveta** renderizada num portal no `<body>`, para não herdar margens de quem a abre.
- Continuam valendo: cores só por tokens, contraste AA (menu: texto secundário 6,7:1, item ativo 4,8:1), nada de gradiente, e as cores de tipo de obra iguais em mapa, gráfico e legenda.

### Leitura da pasta no navegador (30/10/2026)

O painel executivo do usuário atualiza os dados lendo a pasta do OneDrive no próprio navegador, sem aplicativo no Azure e sem aval da TI. Este painel passou a fazer do mesmo jeito. A automação anterior (GitHub Actions + aplicativo no Azure, lendo a pasta pela Microsoft Graph) foi **removida** em 30/10/2026, a pedido do usuário: exigia a TI e o painel executivo prova que não é preciso.

- **Como funciona.** O botão "Atualizar dados" abre uma gaveta: "Conectar pasta" usa a File System Access API (Chrome, Edge) e guarda a pasta no IndexedDB para "Atualizar da pasta" com um clique; nos demais navegadores há "Escolher pasta" (`<input webkitdirectory>`) e "Importar arquivos". A listagem é recursiva (até 6 níveis), aceita KMZ, KML e arquivos sem extensão, ignora ocultos e temporários do Office e recusa pastas com mais de 200 candidatos (apontar para "Documentos" por engano).
- **O pipeline é o mesmo, não um reescrito.** Em vez de portar ~1.500 linhas de Python (geodésia GRS80, UTM, shapely, regras de limpeza) para TypeScript e manter duas implementações, o navegador roda `scripts/build_dataset.py` no **Pyodide** (Python 3.13 em WebAssembly, com numpy, shapely, pyproj e lxml) dentro de um Web Worker. `scripts/navegador.py` só chama `construir`/`escrever` e traduz os erros esperados (pasta sem KMZ, saída bloqueada por privacidade) em mensagens.
- **Conferência.** O Vitest roda o pipeline no Pyodide sobre os KMZ sintéticos e compara **byte a byte** com a saída do Python nativo (`src/lib/pasta/pipeline.test.ts`). Numa base sintética do tamanho da real (5.480 trechos, 10 arquivos com cópias da base), todos os arquivos saíram idênticos, exceto 1 vértice da geometria **simplificada do mapa** (`rede.geojson`), que difere na 5ª casa decimal (~1 m): empate de arredondamento entre versões do GEOS/PROJ do Pyodide e do Python nativo. Indicadores, trechos, inconsistências, projetos e ZEIS são idênticos. Medido no Node: ~20 s de cálculo (7,8 s no Python nativo) e heap do WebAssembly de ~225 MB.
- **Modo completo só no navegador.** Como os dados da pasta não são publicados, o pipeline roda em `completo`: o mapa mostra a rede e a aba Qualidade baixa o CSV por trecho. O bloqueio de e-mails, usuários do GIS e links continua valendo. Quem lê a pasta vê esses dados; o site público segue só com os agregados (decisão da seção 2).
- **O que fica guardado.** Só a pasta lembrada e o resultado já processado (IndexedDB), para o painel abrir já com os dados da pasta. Os KMZ brutos são apagados da memória do worker ao fim de cada execução, e o worker é encerrado. "Voltar aos dados publicados" apaga tudo. O handle da pasta e o nome dela ficam em chaves separadas: ao abrir o painel só se lê o nome (texto) e o resultado, e o handle só é lido quando alguém clica em "Atualizar da pasta". Motivo: no Chromium headless usado nos testes, ler de volta do IndexedDB um handle de pasta (do sistema de arquivos privado, OPFS) fechou a página; não deu para verificar aqui se o Chrome com uma pasta real do disco tem o mesmo problema, mas assim, se tiver, o painel continua abrindo e "Trocar de pasta" resolve. Se o armazenamento do navegador estiver bloqueado, tudo funciona, só sem lembrar entre as visitas. O resultado guardado leva a assinatura do pipeline (hash dos scripts Python e da ficha dos projetos, calculado no build): depois de uma atualização do painel ele é descartado e o painel pede para ler a pasta de novo, em vez de ler dados num formato antigo.
- **Quem vê o quê.** Os dados da pasta valem só para o navegador de quem os leu; uma faixa no topo avisa ("Dados da pasta “X”, lidos em …. Ficam só neste navegador"). Para atualizar o site de todos, é preciso gerar e publicar `public/data/` (README).
- **Dependência externa.** O Pyodide e suas bibliotecas (~20 MB, uma vez) vêm do jsDelivr, em versão fixa (`PYODIDE_VERSAO`, igual à do pacote `pyodide` no `package.json`; um teste confere). `VITE_PYODIDE_URL` aponta para uma cópia própria, se a rede da empresa bloquear o jsDelivr. A cópia local para testes é montada por `npm run pyodide:local`.
- **Limites conhecidos.** O navegador precisa de WebAssembly e de módulos em Web Worker (Chrome/Edge 80+, Firefox 114+, Safari 15+). Arquivos de mais de 300 MB são ignorados. Subpastas com o mesmo nome de arquivo viram "nome (2)" para o pipeline não sobrescrever. `.zip` não é aberto.

## 5. Cores e contraste

Contraste calculado com a fórmula WCAG 2.x (luminância relativa):

| Token | Claro (sobre `--surface`) | Escuro (sobre `--surface`) | Uso permitido |
|---|---|---|---|
| `--text` | 16,4:1 | 14,1:1 | Texto |
| `--text-muted` | 5,5:1 | 6,5:1 | Texto secundário |
| `--brand` | 8,9:1 | 7,1:1 | Texto, aba ativa, foco |
| `--bad` | 5,5:1 | 5,5:1 | Marcador |
| `--net-improvement` | 5,4:1 | 6,1:1 | Marcador |
| `--ok` | 4,4:1 | 7,6:1 | Marcador |
| `--project` | 3,7:1 | 6,5:1 | Marcador |
| `--warn` | 3,7:1 | 8,0:1 | Marcador |
| `--net-extension` | 3,3:1 | 7,9:1 | Marcador |
| branco sobre `--brand` (cabeçalho) | 8,9:1 | — | Texto |

Regra adotada: **texto sempre em `--text`, `--text-muted` ou `--brand`**. As cores de tipo e de estado aparecem só em marcas gráficas (linhas, barras, pontos de pill), onde o mínimo é 3:1 (WCAG 1.4.11), e sempre acompanhadas de texto. No tema claro, extensão, projeto, atenção e "bom" ficam abaixo de 4,5:1 e por isso nunca são usados como cor de texto.

Paleta categórica (rede existente, extensão, melhoria, projeto, ZEIS) validada para daltonismo com o validador do skill de visualização: separação mínima entre pares adjacentes ΔE 10,4 (protanopia) no claro e 9,8 (deuteranopia) no escuro, acima do alvo de 8. O cinza da rede existente e o amarelo da ZEIS ficam abaixo de 3:1 sobre branco de propósito (contexto e preenchimento a 20%); a legenda e os rótulos compensam. Proposta = linha tracejada; diâmetro = espessura, para não depender só de cor.

Token acrescentado ao escopo: `--header-bg`/`--header-text`/`--header-muted` (cabeçalho na cor da marca no claro e em `--surface` no escuro, onde o azul claro ofuscaria).

## 6. Performance e acessibilidade (Lighthouse 12, mobile simulado)

Build de produção servido com gzip (como no GitHub Pages) e base completa (o modo agregado publicado é mais leve, porque o mapa não baixa a rede):

| Aba | Performance | Acessibilidade | Boas práticas |
|---|---|---|---|
| Visão geral | 92 | 100 | 100 |
| Carteira | 99 | 100 | 100 |
| Qualidade | 99 | 100 | 100 |
| Mapa | 63 | 100 | 96 |

O mapa fica abaixo de 90. O motivo é o MapLibre (285 KB gzip) mais o WebGL, que no ambiente de medição roda em software (SwiftShader) sobre a CPU com lentidão simulada de 4×. Em aparelho com GPU o custo é bem menor, mas isso não foi medido aqui. O "boas práticas 96" vem do mapa base bloqueado no ambiente de medição. Tamanhos com gzip: `rede.geojson` 157 KB, `trechos.json` 127 KB (abaixo do limite de 2 MB).

O que foi feito para chegar aí: fontes sem bloquear a renderização, `preload` dos dados da aba inicial, aba inicial no pacote principal e as outras sob demanda, ECharts sob demanda, rede interpretada no worker.

## 7. Processo

- O escopo pede uma branch e um PR por fase. Nesta sessão o trabalho foi feito numa única branch de desenvolvimento, com commits por bloco (pipeline, painel, documentação). As fases 0 a 5 estão cobertas; falta ativar o GitHub Pages.
- Python 3.11 na CI; o pipeline também roda em 3.13.
