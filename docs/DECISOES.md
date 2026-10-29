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
- **Escolha da base**: as 5 cópias têm o mesmo hash de atributos + coordenadas. Usa-se uma cópia pura (sem projeto desenhado) como Referência; a outra pura vai para Arquivar.
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

Build de produção servido com gzip (como no GitHub Pages) e base completa:

| Aba | Performance | Acessibilidade | Boas práticas |
|---|---|---|---|
| Visão geral | 92 | 100 | 100 |
| Carteira | 99 | 100 | 100 |
| Qualidade | 99 | 100 | 100 |
| Mapa | 63 | 100 | 96 |

O mapa fica abaixo de 90. O motivo é o MapLibre (285 KB gzip) mais o WebGL, que no ambiente de medição roda em software (SwiftShader) sobre a CPU com lentidão simulada de 4×. Em aparelho com GPU o custo é bem menor, mas isso não foi medido aqui. O "boas práticas 96" vem do mapa base bloqueado no ambiente de medição. Tamanhos com gzip: `rede.geojson` 157 KB, `trechos.json` 127 KB (abaixo do limite de 2 MB).

O que foi feito para chegar aí: fontes sem bloquear a renderização, `preload` dos dados da aba inicial, aba inicial no pacote principal e as outras sob demanda, ECharts sob demanda, rede interpretada no worker.

## 7. Processo

- O escopo pede uma branch e um PR por fase. Nesta sessão o trabalho foi feito numa única branch de desenvolvimento, com commits por bloco (pipeline, painel, documentação). As fases 0 a 5 estão cobertas; falta só ativar o GitHub Pages e decidir sobre a publicação da base.
- Python 3.11 na CI; o pipeline também roda em 3.13.
