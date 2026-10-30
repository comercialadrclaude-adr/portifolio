# Atualizar os dados a partir de uma pasta do OneDrive

Fluxo depois de configurado:

1. A equipe coloca os KMZ (ou um zip com eles) na pasta do OneDrive da empresa. Os arquivos podem vir sem extensão, como o Google Earth exporta.
2. A automação **Atualizar dados (OneDrive)** do GitHub baixa a pasta, roda o pipeline, confere os testes de regras e privacidade e publica **só os dados agregados** em `public/data/`.
3. O site é publicado de novo. Leva de 2 a 3 minutos.

A automação roda sozinha de segunda a sexta às 06:17 (Brasília). Para rodar na hora, use o botão **Atualizar dados** no menu do painel: ele abre a automação no GitHub, onde você clica em **Run workflow**. Só quem tem acesso de escrita ao repositório consegue rodar.

Os KMZ brutos nunca vão para o repositório nem para o site: ficam só durante a execução, na máquina temporária do GitHub.

## Configuração (uma vez)

### Parte 1 – TI: registrar um aplicativo no Azure

Como é o OneDrive da empresa, o acesso automático precisa de um aplicativo registrado no Microsoft Entra ID (Azure AD), com consentimento do administrador.

1. **Portal do Azure → Microsoft Entra ID → Registros de aplicativo → Novo registro**
   - Nome: `Painel Extensões R4 – leitura OneDrive`
   - Tipos de conta: *somente este diretório*
   - Sem URI de redirecionamento
2. **Permissões de API → Adicionar → Microsoft Graph → Permissões de aplicativo**:
   - **Opção restrita (recomendada):** `Sites.Selected`, e depois conceder ao aplicativo acesso de **leitura** só ao OneDrive (site pessoal) ou ao site do SharePoint onde fica a pasta.
   - **Opção simples:** `Files.Read.All`, que dá leitura em todos os arquivos da empresa. Use só se a política da TI permitir.
3. **Conceder consentimento do administrador** para a permissão escolhida.
4. **Certificados e segredos → Novo segredo do cliente**. Copie o **valor** do segredo na hora, porque ele não aparece de novo. Anote a validade e renove antes de vencer.
5. Anote também, na página **Visão geral** do aplicativo:
   - **ID do diretório (locatário)** → `AZURE_TENANT_ID`
   - **ID do aplicativo (cliente)** → `AZURE_CLIENT_ID`

O aplicativo só **lê**: não grava nem apaga nada no OneDrive.

### Parte 2 – Você: link da pasta

No OneDrive, clique com o botão direito na pasta dos KMZ → **Compartilhar** → **Copiar link**. Um link restrito a pessoas da empresa funciona: o aplicativo lê com as próprias credenciais.

O link fica parecido com `https://empresa-my.sharepoint.com/:f:/g/personal/...`.

### Parte 3 – Guardar os segredos no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**. Crie os quatro segredos:

| Nome | Valor |
|---|---|
| `AZURE_TENANT_ID` | ID do diretório (locatário) |
| `AZURE_CLIENT_ID` | ID do aplicativo (cliente) |
| `AZURE_CLIENT_SECRET` | Valor do segredo do cliente |
| `ONEDRIVE_LINK_PASTA` | Link de compartilhamento da pasta |

Os segredos ficam criptografados no GitHub. Não aparecem nos logs, no código nem no site.

### Parte 4 – Testar

**Actions → Atualizar dados (OneDrive) → Run workflow**. Ao final, o resumo da execução mostra a data da base, os totais e eventuais avisos (por exemplo, versões diferentes da base na pasta).

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| "Conexão com o OneDrive ainda não configurada. Faltam os segredos…" | Criar os segredos da Parte 3. Enquanto faltarem, a execução diária só registra um aviso. |
| "O Azure não devolveu token" | Conferir tenant, client id e segredo (o segredo pode ter vencido). |
| Erro 403 ao acessar `graph.microsoft.com` | Falta consentimento do administrador, ou o `Sites.Selected` não inclui a pasta. |
| Erro 404 em `/shares/` | O link mudou ou a pasta foi movida: gerar o link de novo e atualizar `ONEDRIVE_LINK_PASTA`. |
| "Nenhum KMZ/KML encontrado" | A pasta está vazia ou só tem outros tipos de arquivo. Subpastas não são lidas. |
| Testes falhando em privacidade | Algum dado pessoal apareceria na saída. Nada é publicado. Avise quem mantém o painel. |

## Detalhes técnicos

- `scripts/baixar_onedrive.py`: credenciais de cliente → token do Graph → `GET /shares/{link codificado}/driveItem/children` → baixa `.kmz`, `.kml`, `.zip` (extraído) e arquivos sem extensão. Só usa a biblioteca padrão do Python. Os nomes são validados, e caminhos dentro de zips são descartados.
- `.github/workflows/atualizar-dados.yml`: baixa, gera em modo agregado, testa, faz commit de `public/data/` na `main` só se algo mudou e dispara o deploy.
- Os testes de referência do escopo (5.480 trechos etc.) são pulados quando a base muda. Os de regras e privacidade sempre rodam.
