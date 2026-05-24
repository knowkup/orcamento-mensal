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
- Manter Git organizado: trabalhar com commits pequenos, mensagens claras e `git status` limpo ao finalizar cada etapa.
- Criar subpastas quando isso melhorar a organizacao do projeto, sem trocar stack ou recriar estrutura sem necessidade.

## Produto

- Nome: Orcamento Mensal.
- Objetivo: controle mensal de orcamento pessoal.
- Foco: clareza, uso recorrente e mobile.
- Interface simples, direta e humana.
- A planilha atual e a referencia principal de produto; ela e pratica e entrega as visoes que o usuario quer.
- Nao substituir por um dashboard generico. Antes de desenvolver, entender e preservar a logica real da planilha.

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

## Modelo real da planilha

- A aba principal `Dívida Cronologia` e a visao central do produto: ela mostra o futuro financeiro, com detalhamento suficiente para entender quando melhora, quando sobra, quando falta e como eventos futuros reorganizam os meses.
- A aba principal deve continuar sendo a tela mais importante do sistema, nao um dashboard resumido.
- `Parcelas` controla compras parceladas em cartao de credito. Cada cadastro precisa ter origem/cartao, valor, prazo/parcelas e andamento.
- Parcelas cadastradas em `Parcelas` alimentam automaticamente a aba principal dentro da origem/cartao correspondente. Exemplo: uma compra Nubank entra nos meses futuros somando no bloco/linha do Nubank.
- `Custo Fixo` serve para cadastrar custos fixos, principalmente custos fixos dos cartoes/origens. Custos fixos PIX nao necessariamente alimentam a aba principal.
- Na aba principal, cada origem/cartao pode reunir parcelas vindas da aba `Parcelas`, custos fixos vindos da aba `Custo Fixo` e compras gerais planejadas digitadas diretamente na projecao do mes.
- Compras gerais planejadas na aba principal sao usadas para simular gastos do mes e verificar se sera possivel fechar o mes.
- `Jeep Compass` e um modulo proprio do financiamento do carro. Pagamentos feitos nessa aba precisam atualizar a aba principal/projecao.
- `Ant.FGTS` e um modulo proprio para antecipacoes de FGTS, contratos/emprestimos, valores pagos, valores futuros e objetivo de quitacao.
- O ato de pagar hoje equivale a remover/baixar a ocorrencia daquele valor da projecao futura, como o usuario faz hoje deletando o valor no Excel. No sistema, isso precisa ser simples e por ocorrencia especifica, nao por item geralzao.
- O usuario nao quer um cadastro generico de "custos fixos" ou um total mensal agregado que esconda a origem dos valores.
- A tela de itens criada no MVP atual esta desalinhada com a planilha e nao deve guiar a proxima modelagem.

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

## Atualizacao - 2026-05-24 12:04:00

### Decisoes tomadas

- Usuario definiu regra adicional: manter o Git sempre organizado.
- Quando fizer sentido, o agente pode criar subpastas para melhorar a organizacao do projeto.

### Mudancas feitas

- Atualizadas premissas operacionais no contexto.

### Backups criados

- Nenhum backup criado; apenas documentacao de regra operacional.

### Comandos relevantes

- `git status --short --branch`
- `Get-Content -Raw CONTEXTO.md`

### Pendencias

- Fazer commit e push desta atualizacao de contexto.

### Proximos passos

- Seguir mantendo commits pequenos, Git limpo e estrutura organizada.

## Atualizacao - 2026-05-24 12:12:00

### Decisoes tomadas

- Usuario rejeitou o MVP atual por estar generico e pior que a planilha.
- Nao corrigir superficialmente o app atual; voltar a entender a planilha como fonte de verdade.
- A proxima modelagem deve partir da logica real das abas e das relacoes entre elas.

### Mudancas feitas

- Registrado o modelo real da planilha no contexto.
- Marcado que a tela `Itens` e o cadastro generico do MVP atual estao desalinhados com o uso real.

### Backups criados

- Nenhum backup criado; apenas documentacao de entendimento de produto.

### Comandos relevantes

- `git status --short --branch`
- `Get-Content -Raw CONTEXTO.md`

### Pendencias

- Revisar a planilha de novo antes de qualquer nova implementacao.
- Mapear a aba principal `Dívida Cronologia` como produto/tela central.
- Redesenhar o modelo de dados com origens/cartoes, parcelas, custos fixos por origem, compras planejadas, financiamento Jeep e antecipacoes FGTS.
- Nao desenvolver nova versao ate o entendimento da planilha estar claro.

### Proximos passos

- Fazer uma etapa de leitura/modelagem da planilha antes de alterar codigo.

## Atualizacao - 2026-05-24 14:17:02

### Decisoes tomadas

- A etapa atual foi limitada a analise/modelagem da planilha; nenhuma mudanca no app.
- Criada pasta `docs/` para documentacao de produto e arquitetura.
- A planilha segue como fonte de verdade para a proxima versao.

### Mudancas feitas

- Criado `docs/PLANILHA_MODELO.md` com o modelo real da planilha, relacoes entre abas e implicacoes para o sistema.
- Gerado arquivo tecnico temporario/backup `backups/planilha-modelagem-runtime.json` durante a leitura da planilha.

### Backups criados

- `backups/20260524-141702`

### Comandos relevantes

- Leitura da planilha com Python/openpyxl usando runtime empacotado.
- `git status --short --branch`
- `git diff --check`

### Pendencias

- Validar a modelagem documentada com o usuario antes de alterar o app.
- Depois de validada, redesenhar o modelo de dados e as telas a partir de `docs/PLANILHA_MODELO.md`.

### Proximos passos

- Revisar `docs/PLANILHA_MODELO.md` com o usuario e ajustar pontos que ainda estiverem errados.

## Atualizacao - 2026-05-24 14:26:36

### Decisoes tomadas

- Usuario aprovou a modelagem geral e autorizou codar uma nova versao para validar em producao.
- A antiga `Dívida Cronologia` passa a se chamar `Controle Mensal`.
- A antiga aba `Jeep Compass` passa a ser modulo `Carro`.
- O modulo `Carro` deve cadastrar carro e financiamento e permitir gestao das parcelas.
- Funcao de concluir financiamento e preparar novo financiamento fica no roadmap futuro.

### Mudancas feitas

- Refatorado `index.html` para telas: `Controle Mensal`, `Parcelas`, `Custos Fixos`, `Carro`, `FGTS` e `Ajustes`.
- Refatorado `app.js` para modelo de dados unico em `users/{uid}/app/state`.
- Implementada grade de 12 meses com entradas, saidas, totais, sobra mensal e saldo acumulado.
- Implementados cadastros separados de parcelas, custos fixos, compras planejadas, carro e FGTS.
- Parcelas e custos fixos agora alimentam linhas especificas do `Controle Mensal` por origem/descricao.
- Implementada baixa simples por ocorrencia na grade e nas ocorrencias do mes.
- Atualizado `styles.css` para comportar grade operacional, tabelas e modulos.
- Atualizado `README.md` e `docs/PLANILHA_MODELO.md` com nomes e roadmap.

### Backups criados

- `backups/20260524-142636`

### Comandos relevantes

- `node --check app.js`
- `git diff --check`
- Validacao estatica de seletores `id` usados pelo JavaScript.
- `Invoke-WebRequest http://127.0.0.1:4897/index.html`

### Pendencias

- Validar visualmente em producao pelo GitHub Pages.
- Ajustar a logica com base na validacao real do usuario.
- Importar dados reais da planilha em etapa futura.
- Refinar mobile em etapa posterior.

### Proximos passos

- Fazer commit e push para producao.

## Atualizacao - 2026-05-24 14:47:47

### Decisoes tomadas

- Usuario reportou que o botao `Entrar` nao abre login Google.
- `Origens` em Ajustes estava conceitualmente errado; deve virar cadastro de `Credores`.
- Credor deve permitir tipo: emprestimo, debito em conta, financiamento, cartao de credito ou outro.
- Credor pode ter logo, inspirado no projeto `Rota Financeira (Dívidas)`.
- `Forma` em custos fixos deve ser metodo de pagamento: PIX, debito em conta, cartao de credito ou boleto.
- Custos fixos, parcelas e FGTS devem se vincular a credores.
- Parcelas e Carro precisam separar pendentes e pagas.
- FGTS precisa permitir expandir contrato, registrar pagamentos anuais e quitar por valor informado.
- Controle Mensal precisa separar visualmente entradas/saidas e melhorar rolagem horizontal.

### Mudancas feitas

- Ajustado login Google com tratamento de erro e fallback para redirecionamento.
- Criado cadastro de credores com tipo e upload de logo pequena.
- Substituidos selects de origem por selects de credor.
- Adicionado metodo de pagamento em custos fixos.
- Adicionada exclusao de custos fixos e parcelas.
- Adicionadas abas pendentes/pagas em parcelas e carro.
- Adicionada expansao de parcelas para ver parcelas pagas/pendentes.
- Adicionada expansao de emprestimos FGTS com pagamentos anuais e acao de quitacao.
- Adicionada rolagem horizontal superior no Controle Mensal.
- Melhorada separacao visual entre entradas e saidas no Controle Mensal.
- Consultado projeto `Rota Financeira (Dívidas)` para inspiracao de credores/logos.

### Backups criados

- `backups/20260524-144747`

### Comandos relevantes

- `rg -n "credor|Credor|config|Config|logo|Logo" "C:\\Users\\felip\\OneDrive\\Documentos\\14. Sistemas Kupka\\Rota Financeira (Dívidas)"`
- `node --check app.js`
- `git diff --check`
- Validacao estatica de seletores `id` usados pelo JavaScript.

### Pendencias

- Validar login em producao. Se aparecer erro `auth/unauthorized-domain`, adicionar `kupka1988.github.io` em Firebase Authentication > Settings > Authorized domains.
- Validar fluxo real no Firebase com dados do usuario.
- Ajustar modelo de credores/tipos conforme uso real.

### Proximos passos

- Fazer commit e push para producao.

## Atualizacao - 2026-05-24 15:08:01

### Decisoes tomadas

- Cadastro de credores deve seguir o padrao visual do projeto `Rota Financeira`: lista limpa, logo, tipo e botoes de acao.
- O card `Dados` da tela Ajustes nao faz sentido neste produto e foi removido.
- Credor passa a ser editavel em modal, nao em formulario fixo ocupando a tela.
- FGTS deve tratar cada emprestimo como contrato parcelado, com parcelas pendentes e pagas dentro do item expandido.
- O padrao visual de parcelas deve caminhar para resumo superior, abas `Pendentes`/`Pagas` e tabela operacional.
- A interface deve ficar mais clean, clara e premium, com menos cara de mockup e menos cartoes decorativos.

### Mudancas feitas

- Ajustes agora mostra somente a lista de credores, com botao `Novo credor`.
- Criado modal para cadastrar e editar credores com nome, tipo e logo.
- Adicionados botoes de editar e excluir/bloquear exclusao na lista de credores.
- Removido o painel `Dados` de Ajustes.
- FGTS passou a cadastrar emprestimos com valor da parcela, total de parcelas, parcelas pagas, primeiro vencimento e valor de quitacao.
- Cada emprestimo FGTS agora gera parcelas, separa pendentes/pagas, permite registrar pagamento de parcela e permite quitar o contrato.
- Adicionado resumo expandido por emprestimo FGTS com criada em, tipo, parcelas pagas e proximo vencimento.
- Ajustado visual geral com primario verde, tabelas mais limpas, cards de divida e menor sensacao de mockup.
- Corrigidos textos novos para evitar encoding quebrado na interface.

### Backups criados

- `backups/20260524-150801`

### Comandos relevantes

- `git status --short --branch`
- `node --check app.js` usando runtime empacotado do Codex.
- `git diff --check`
- Validacao estatica de seletores `id` usados pelo JavaScript.
- `Invoke-WebRequest http://127.0.0.1:4897/index.html`

### Pendencias

- Testar visualmente em producao pelo GitHub Pages apos o push.
- O navegador interno do Codex nao estava disponivel nesta sessao (`No active Codex browser pane available`), entao a verificacao visual automatizada nao foi concluida.
- Replicar o mesmo padrao visual completo de parcelas pendentes/pagas em `Parcelas` e `Carro` com ainda mais fidelidade ao print, se a validacao do FGTS ficar boa.
- Ajustar dados reais do Firebase conforme o usuario validar a modelagem.

### Proximos passos

- Fazer commit e push desta rodada.
