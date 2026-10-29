# Dicionário de dados

Arquivos gerados por `scripts/build_dataset.py` em `public/data/`. As definições das métricas são as mesmas de `src/lib/metrics.ts` (tooltips do painel).

## Métricas

| Métrica | Definição |
|---|---|
| Rede cadastrada (km) | Soma do campo `EXTENSAO` de todos os trechos cadastrados, em km. |
| Extensões validadas (km) | Soma de `EXTENSAO` dos trechos classificados como Extensão (campo `Classsific` ou, se vazio, `NOTAS`). |
| % da rede | Extensões validadas (km) ÷ rede cadastrada (km) × 100. |
| Melhorias validadas (km) | Soma de `EXTENSAO` dos trechos classificados como Melhoria. |
| Completude cadastral (%) | Trechos com material e diâmetro (> 0) informados ÷ total de trechos. Diâmetro 0 conta como não informado. |
| Projetos em carteira | Propostas desenhadas no Google Earth fora da base cadastral. Metros = comprimento geodésico do traçado. |
| Distância até a rede (m) | Menor distância (m) entre o ponto de interligação (ou a primeira feição) e qualquer trecho cadastrado. É a distância até a **linha**, não até o vértice mais próximo. |
| Distância até a ZEIS (m) | Menor distância (m) entre o projeto e um polígono de ZEIS; 0 = dentro. |
| Rede interna da ZEIS (m) | Comprimento dos trechos recortados pelo polígono da ZEIS. |
| Densidade da ZEIS (m/ha) | Rede interna (m) ÷ área da ZEIS (ha). |
| Data de cadastro | `CREATED_DA`: data em que o trecho foi cadastrado no GIS. **Não é a data da obra.** |
| Índice de prioridade (0–100) | Média ponderada das notas (0–1) dos critérios com dado: proximidade da rede, ZEIS, ligações previstas, custo por metro. Pesos em `src/lib/priority.ts`. |

Comprimentos e áreas são geodésicos (elipsoide GRS80). Distâncias e recortes usam SIRGAS 2000 / UTM da zona do objeto (23S ou 24S).

## Campos da base cadastral

| Campo de origem | Publicado como | Tratamento |
|---|---|---|
| `MUNICIPIO` | `municipio` | Espaços normalizados; caixa alta vira caixa de título. |
| `BAIRRO` | `bairro` | "Cenrto" → "Centro"; "n/a", "NULL", "<NULL>" e vazio → nulo; preposições em minúsculas ("Barra De São João" → "Barra de São João"). |
| `EXTENSAO` | `extensao_m` | Número (m). Vírgula decimal aceita. |
| (geometria) | `comprimento_m` | Comprimento geodésico do desenho, para conferir `EXTENSAO`. |
| `DIAMETRO_N` | `diametro_mm` | 0 = não informado (nulo). |
| `MATERIAL` | `material`, `material_codigo` | Código longo → rótulo curto (tabela abaixo); o código original fica em `material_codigo`. |
| `TIPO_PAVIM` | `pavimento` | "Paralelepipedo"/"Paralelepípedo" e "Calcada"/"Calçada" unificados. |
| `FUNCAO` | `funcao` | "Distribuicao" → "Distribuição"; "Aducao…" → "Adução…". |
| `PROFUNDIDA` | `profundidade_m` | 0 = não informado (nulo). |
| `SITUACAO` | `situacao` | Sem alteração. |
| `CREATED_DA` | `cadastro` | ISO `aaaa-mm-dd`. Data de cadastro no GIS. |
| `GLOBALID` | `globalid` | Identificador do GIS, para localizar o trecho na base corporativa. |
| `Classsific` (três "s"), `NOTAS` | `tipo` | Ver regra de tipo de obra. Os textos não são publicados. |
| `FUNCAO_1`, `DESCRICA_1` | — | Duplicam `FUNCAO` e `DESCRICAO`: descartados. |
| `Shape__Len` | — | Está em graus, não em metros: descartado. |
| `DESCRICAO` | — | Só usado para detectar links locais/internos. Não publicado. |
| `CREATED_US`, `LAST_EDITE` | — | E-mails de funcionários. **Nunca publicados.** |
| `LAST_EDI_1` | `manifest.dados_ate` | Data da última edição na base (a "data dos dados" do cabeçalho). |
| `REGIONAL`, `UF`, `UN`, `SUP`, `ALINHAMENT`, `ALINHAME_1` | — | Não usados no painel. |

Cada trecho recebe um `id` curto (`T00001`…) na ordem da base.

### Tipo de obra

Lê `Classsific` e, se vazio, `NOTAS` (sem acento, maiúsculas):

| Contém | Tipo (`tipo`) | Rótulo | Cor |
|---|---|---|---|
| `EXTENS` | `extensao` | Extensão | `--net-extension` |
| `MELHORIA` | `melhoria` | Melhoria | `--net-improvement` |
| `SUBSTITU` | `substituicao` | Substituição | `--net-existing` |
| `ENCONTRADA` | `encontrada` | Rede encontrada | `--net-existing` |
| `DOADA` | `doada` | Rede doada | `--net-existing` |
| (outro) | `existente` | Rede existente / sem classificação | `--net-existing` |

### Material

| Código de origem | Rótulo |
|---|---|
| `PVC_Policloreto_de_vinila` | PVC |
| `PEAD_Polietileno_alta_densidade` | PEAD |
| `FF_Ferro_fundido` | Ferro fundido |
| `MPVC_DEFOFO`, `DEFOFO` | DEFOFO |
| `CA_Cimento_amianto` | Cimento amianto |
| `FD_Ferro_ductil` | Ferro dúctil |
| demais (`Aco`, `Chumbo`, `FG_…`, `PRFV_…`, `RPVC_…`, `BIAX_…`, `MPE_…`, `PA_…`, `CC_…`) | Outros |

A contagem dos códigos agrupados em "Outros" fica em `manifest.json → materiais_outros`.

### Faixas de diâmetro (espessura no mapa)

`f` em `rede.geojson`: 0 = não informado · 1 = até 75 mm · 2 = 76 a 150 mm · 3 = acima de 150 mm.

## Inconsistências

| Código | Gravidade | Regra |
|---|---|---|
| `sem_material` | Alta | Material vazio. |
| `sem_diametro` | Alta | Diâmetro 0 ou vazio. |
| `extensao_divergente` | Alta | \|`EXTENSAO` − comprimento do desenho\| > 5 m **e** > 20%. |
| `sem_extensao` | Alta | `EXTENSAO` vazia ou 0. |
| `material_chumbo` | Média | Material cadastrado como chumbo (atípico; confirmar). |
| `sem_bairro`, `sem_funcao`, `sem_pavimento`, `sem_profundidade` | Média | Campo vazio (ou 0, na profundidade). |
| `sem_data_cadastro` | Média | `CREATED_DA` vazio. |
| `link_local` | Média | `DESCRICAO` aponta para `file:///` (arquivo no computador de alguém). |
| `link_interno` | Baixa | `DESCRICAO` tem link de SharePoint/Drive/OneDrive. |
| `bairro_grafia`, `pavimento_grafia` | Baixa | Grafia corrigida automaticamente pelo pipeline. |
| `material_fora_padrao` | Baixa | Material agrupado em "Outros". |

Alta = impede dimensionar ou orçar · Média = atrapalha relatórios · Baixa = padronização de texto.

## Arquivos de saída

| Arquivo | Conteúdo |
|---|---|
| `manifest.json` | Data de geração, `dados_ate`, modo, hash de cada fonte, contagens, avisos, tamanhos. `gerado_em` só muda quando o conteúdo muda (saída idempotente). |
| `indicadores.json` | `todos` + `municipios[]`: rede, extensões, melhorias, completude, `por_tipo`, `mensal` (km e trechos de extensão por mês de cadastro), `preenchimento` por atributo, projetos e `bbox`. |
| `projetos.json` | `etapas` + `projetos[]`: ficha, medidas, distâncias, pendências e campos "a preencher". |
| `projetos.geojson` | Feições dos projetos com `projeto` e `papel` (`tracado`, `interligacao`, `inicio`, `final`, `area`, `marcador`). |
| `zeis.json` / `zeis.geojson` | ZEIS com área, rede interna, densidade e extensões internas. |
| `sedes.geojson` | Sedes municipais do arquivo de ZEIS. |
| `relevo.geojson` | Geomorfologia (padrão, código, amplitude, declividade), simplificada a 5 m. |
| `inconsistencias.json` | Regras com total, contagem por município e (modo completo) ids dos trechos. |
| `portfolio.json` | Inventário dos KMZ: tipo, conteúdo, contagens, hash da base e uso sugerido (Projeto / Referência / Arquivar / Excluir). |
| `rede.geojson` | (modo completo) Trechos simplificados a ~1 m, 5 casas decimais, com `id`, `t` (tipo), `f` (faixa de diâmetro), `m` (município). |
| `trechos.json` | (modo completo) Atributos limpos por trecho. |

## Ficha manual dos projetos (`data/projetos_meta.json`)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | texto | Fixa o ID (P1, P2…). Sem ele, o ID segue o traçado decrescente. |
| `etapa` | texto | Uma das 7 etapas padronizadas. Sem ela, a etapa é inferida (traçado → "Traçado preliminar"; só área → "Estudo") e marcada "a confirmar". |
| `solicitante`, `motivo`, `responsavel` | texto | Não use e-mail nem telefone (arquivo público). |
| `ligacoes_previstas` | número | |
| `custo_estimado_brl` | número | O painel calcula custo por ligação e por metro. |
| `data_prevista`, `data_real` | `aaaa-mm-dd` | |
