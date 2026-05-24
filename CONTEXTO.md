# Contexto do Projeto Orçamento Mensal

Data inicial: 2026-05-24

## Premissas operacionais

- Trabalhar sempre na pasta oficial do OneDrive.
- Manter este arquivo atualizado ao final de cada tarefa.
- Criar backups em `backups/YYYYMMDD-HHMMSS` antes de mudancas relevantes.
- Nao versionar `backups/`.
- Trabalhar incrementalmente, sem trocar stack ou recriar estrutura sem pedido explicito.
- Validar antes de finalizar sempre que houver validacoes disponiveis.
- Revisar `git diff` antes de concluir.
- Ao alterar codigo, fazer commit e push ao final quando houver remoto configurado.

## Produto

- Nome: Orcamento Mensal.
- Objetivo: controle mensal de orcamento pessoal.
- Foco: clareza, uso recorrente e mobile.
- Interface simples, direta e humana.

## Decisoes tomadas

- Estrutura inicial sera simples, com HTML, CSS e JavaScript puro quando a aplicacao for criada.
- Branch principal esperada: `main`.
- Backups ficarao em `backups/` e serao ignorados pelo Git.
- Ainda nao iniciar desenvolvimento; primeiro consolidar entendimento da planilha e do produto.
- MVP recomendado, quando autorizado: dashboard mensal, custos fixos, compras parceladas, dividas/contratos e linha do tempo automatica.
- A aba `Divida Cronologia` deve virar uma tela gerada automaticamente, nao um cadastro manual.
- Manter Excel/CSV como possibilidade de importacao/exportacao para nao perder flexibilidade.
- O sistema precisa usar Firebase desde o inicio, porque o usuario usa mais de um computador e iPhone.
- Firebase deve ser usado para sincronizacao entre dispositivos, com regras seguras antes de qualquer publicacao.
- O primeiro MVP deve continuar simples; Firebase nao deve transformar o produto em algo complexo.

## Analise recebida da planilha

- Arquivo na raiz: `Orçamento mensal.xlsx`.
- Arquivos auxiliares colados pelo usuario em `files-mentioned-by-the-user-or/`:
  - `orcamento_visible_analysis.json`: analise estrutural das abas visiveis.
  - `orcamento_consistency.json`: consistencia, abas ocultas, validacoes, erros de formula, dependencias e amostras de faixas/formulas.
- Analise previa considerou somente abas nao ocultas.
- Abas visiveis mapeadas: `Dívida Cronologia`, `Parcelas`, `Custo Fixo`, `Jeep Compass` e `Ant.FGTS`.
- O JSON de consistencia registra 28 abas ocultas, 5 abas visiveis, 1 erro de formula, 4 validacoes de lista e 50 amostras de formulas/faixas fixas.
- Metricas das abas visiveis no JSON estrutural:
  - `Dívida Cronologia`: 505 celulas preenchidas, 189 formulas.
  - `Parcelas`: 555 celulas preenchidas, 373 formulas, 1 validacao.
  - `Custo Fixo`: 182 celulas preenchidas, 4 formulas, 2 validacoes.
  - `Jeep Compass`: 400 celulas preenchidas, 69 formulas, 1 validacao.
  - `Ant.FGTS`: 214 celulas preenchidas, 48 formulas.
- `Dívida Cronologia`: projecao mensal de entradas, custos fixos, parcelas e saldo; depende principalmente de `Parcelas` e `Custo Fixo`.
- `Parcelas`: compras parceladas com origem, prazo, data, valor, parcelas pagas/faltantes, total pago, diferenca e progresso.
- Totais em `Parcelas`: divida total R$ 19.269,45; valor pago R$ 13.358,96; falta pagar R$ 5.910,49; curto prazo R$ 3.974,64; medio prazo R$ 1.935,85; longo prazo R$ 0,00.
- Erro conhecido: `Parcelas!V10` com `#DIV/0!` porque o bloco de longo prazo divide por divida total igual a zero.
- `Custo Fixo`: cadastro recorrente de despesas por custo, forma de pagamento, grupo, vencimento e valor; custo total atual R$ 10.288,39.
- `Jeep Compass`: financiamento do carro, parcelas pagas, pendentes e economia por parcela.
- Totais em `Jeep Compass`: financiado R$ 107.981,00; compra R$ 133.900,00; financiamento projetado R$ 217.267,20; pago R$ 42.846,84; falta pagar R$ 173.813,76; economia R$ 606,60; 48 parcelas pendentes de 60.
- `Ant.FGTS`: antecipacoes de FGTS, contratos, valores recebidos/pagos, parcelas futuras e saldo bloqueado/liberado.
- Totais em `Ant.FGTS`: bloco 1 recebido R$ 5.740,98, pago R$ 3.601,89, economia/ajuste R$ 304,97; bloco 2 recebido R$ 15.046,51, valor a pagar R$ 32.175,39; saldo R$ 58.647,21, bloqueado R$ 46.495,03, liberado R$ 12.152,18.
- Riscos mapeados: formulas com faixas fixas, valores digitados direto em formulas, erro `#DIV/0!`, logica espalhada entre abas e validacoes de lista limitadas.

## Mudancas feitas

- Criado arquivo de contexto inicial.
- Criado `CONTEXTO_CODEX.md`.
- Criado `.gitignore`.
- Criada pasta local `backups/`.
- Inicializado Git local na branch `main`.
- Configurado usuario Git local como `Codex <codex@local>`.
- Observado arquivo nao versionado `Orcamento mensal.xlsx`/`Orçamento mensal.xlsx`; ele nao foi alterado nem incluido no commit inicial.
- Observada pasta nao versionada `files-mentioned-by-the-user-or/` com arquivos JSON de analise; ela nao foi alterada nem incluida em commit.
- Criado commit inicial da estrutura do projeto.
- Verificado que ainda nao existe remoto Git configurado; push nao executado.
- Registrada analise previa da planilha como insumo de produto, sem iniciar desenvolvimento.
- Lidos os JSONs auxiliares de analise apenas para registrar seu conteudo e utilidade no contexto; nenhum desenvolvimento iniciado.
- Registrada decisao conceitual de usar Firebase por necessidade de sincronizacao entre computador e iPhone.

## Backups criados

- Nenhum backup ainda; a pasta inicial estava vazia.
- Nenhum backup criado nesta atualizacao; apenas documentacao de contexto foi alterada.

## Comandos relevantes

- `Get-Location`
- `Get-ChildItem -Force`
- `git status --short --branch`
- `git init -b main`
- `git config user.name "Codex"`
- `git config user.email "codex@local"`
- `git diff --check`
- `git add .gitignore CONTEXTO.md CONTEXTO_CODEX.md`
- `git commit -m "chore: estrutura inicial do projeto"`
- `git remote -v`
- `git log --oneline -1`
- `Get-Content -Raw CONTEXTO.md`
- `Get-ChildItem -Force "files-mentioned-by-the-user-or"`
- `ConvertFrom-Json` nos arquivos auxiliares para inspecionar estrutura e contagens principais.

## Pendencias

- Configurar remoto GitHub quando existir.
- Fazer push para `origin/main` quando o remoto estiver configurado.
- Decidir posteriormente se a planilha existente deve ser versionada, migrada, importada ou mantida apenas como dado local.
- Decidir posteriormente se os JSONs auxiliares devem ser versionados como documentacao tecnica ou mantidos apenas como referencia local.
- Antes de prototipar, decidir se a planilha sera fonte recorrente de importacao ou migracao unica.
- Antes de prototipar, decidir se o sistema controlara pagamento real mes a mes ou apenas projecao.
- Antes de prototipar, definir projeto Firebase, autenticacao e estrutura inicial de colecoes/documentos.
- Futuramente avaliar notificacoes de vencimento por email ou WhatsApp.

## Proximos passos

- Configurar o remoto GitHub `origin` quando o repositorio existir.
- Fazer push para `origin/main` apos configurar o remoto.
- Aguardar autorizacao explicita antes de iniciar qualquer desenvolvimento.

## Atualizacao - 2026-05-24 11:43:22

### Decisoes tomadas

- Desenvolvimento autorizado pelo usuario nesta conversa.
- MVP inicial sera um app web estatico preparado para GitHub Pages e Firebase.
- Firebase sera usado para sincronizacao entre computadores e iPhone.
- A experiencia inicial prioriza web desktop responsiva; mobile completo pode ser refinado em etapa seguinte.
- Dados financeiros locais sensiveis (`*.xlsx`, `*.csv`, JSONs auxiliares e backups) nao devem ser publicados no GitHub por padrao.

### Mudancas feitas

- Criado `index.html` com a estrutura do app.
- Criado `styles.css` com identidade visual clara e premium financeiro.
- Criado `app.js` com dashboard, projecao, itens, adicionar item, marcar pagamento, desfazer pagamento, exportar/importar JSON e integracao Firebase preparada.
- Criado `firebase-config.js` com campos vazios para a configuracao do projeto Firebase.
- Criado `firestore.rules` com regra por usuario autenticado: `users/{uid}/...`.
- Criado `README.md` com estrutura e orientacao Firebase.
- Criado `.nojekyll` para compatibilidade com GitHub Pages.
- Atualizado `.gitignore` para evitar versionamento acidental da planilha, CSVs, JSONs auxiliares, backups e saidas de teste.

### Backups criados

- `backups/20260524-113457`

### Comandos relevantes

- `node --check app.js` usando Node empacotado do Codex.
- `git diff --check`
- `Start-Process ... python -m http.server 4897 --bind 127.0.0.1`
- Teste local no navegador em `http://127.0.0.1:4897/`.

### Pendencias

- Criar/configurar o projeto Firebase na conta do usuario.
- Preencher `firebase-config.js` com as credenciais publicas do Web App Firebase.
- Publicar `firestore.rules` no Firebase antes de usar dados reais.
- Criar ou conectar repositorio remoto no GitHub.
- Configurar GitHub Pages para publicar a branch `main` pela raiz do repositorio.
- Refinar mobile em uma etapa dedicada apos validar a experiencia web principal.

### Proximos passos

- Validar o MVP com dados reais de teste, sem importar a planilha inteira ainda.
- Depois conectar Firebase e GitHub Pages com a conta do usuario.

## Atualizacao - 2026-05-24 11:49:49

### Decisoes tomadas

- Projeto Firebase criado pelo usuario: `orcamento-mensal-fdc1a`.
- Configuracao Web App Firebase recebida do usuario e aplicada ao projeto.

### Mudancas feitas

- Atualizado `firebase-config.js` com `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` e `measurementId`.

### Backups criados

- `backups/20260524-114949`

### Comandos relevantes

- `node --check app.js`
- `node --check firebase-config.js`
- `git diff --check`

### Pendencias

- Ativar Firebase Authentication com provedor Google.
- Criar Firestore Database em modo producao.
- Publicar `firestore.rules` no Firebase Console.
- Testar login real no app depois que Auth e Firestore estiverem ativos.

### Proximos passos

- Concluir configuracao de Auth e Firestore no console Firebase.

## Atualizacao - 2026-05-24 11:55:00

### Decisoes tomadas

- Usuario informou que Firebase Authentication e Firestore Database foram criados.
- Como a Firebase CLI nao esta instalada localmente, a publicacao das regras sera feita pelo Firebase Console.

### Mudancas feitas

- Nenhuma mudanca de codigo nesta etapa; apenas registro de progresso.

### Backups criados

- Nenhum backup criado; nao houve alteracao de codigo ou dados.

### Comandos relevantes

- `git status --short --branch`
- `Get-Content -Raw firestore.rules`
- `firebase --version`

### Pendencias

- Colar e publicar o conteudo de `firestore.rules` no Firebase Console.
- Testar login Google no app.
- Criar/conectar repositorio remoto GitHub.
- Configurar GitHub Pages.

### Proximos passos

- Publicar regras do Firestore pelo console antes de inserir dados reais.

## Atualizacao - 2026-05-24 12:00:00

### Decisoes tomadas

- Usuario informou que as regras do Firestore foram alteradas e publicadas no Firebase Console.
- Repositorio GitHub criado pelo usuario: `kupka1988/orcamento-mensal`.
- Remoto esperado: `https://github.com/kupka1988/orcamento-mensal.git`.

### Mudancas feitas

- Nenhuma mudanca de codigo nesta etapa; pronto para conectar remoto e publicar no GitHub.

### Backups criados

- Nenhum backup criado; nao houve alteracao em codigo nem dados.

### Comandos relevantes

- `git status --short --branch`
- `git remote -v`
- `git diff --check`

### Pendencias

- Adicionar remoto `origin`.
- Fazer push para `origin/main`.
- Ativar GitHub Pages no repositorio, se ainda nao estiver ativo.
- Testar URL publicada com Firebase Auth e Firestore.

### Proximos passos

- Publicar branch `main` no GitHub.
