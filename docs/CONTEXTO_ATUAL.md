# Contexto atual - Orcamento Mensal + Rota Financeira

Ultima atualizacao: 2026-06-03

Este arquivo e o resumo de onboarding para Codex, Claude ou qualquer agente em outro notebook. Leia antes de mexer no projeto.

## Produto

O projeto deixou de ser apenas um app de Orcamento Mensal. Agora ele unifica:

- Orcamento Mensal: planejamento, controle mensal, parcelamentos, custos fixos, carro, FGTS, ferias e preferencias.
- Rota Financeira: dashboard de dividas, rota de quitacao, dividas em espera, fora do radar, quitadas e renegociacao.

O objetivo nao e criar um dashboard generico. O app precisa preservar a logica real da planilha original e, ao mesmo tempo, permitir controlar a frente de dividas.

## Arquitetura

Arquivos principais:

- `index.html`: estrutura de todas as telas e dialogs.
- `styles.css`: design system, responsividade e estilos das duas areas.
- `js/app.js`: boot principal, bindings globais, navegacao e render geral.
- `js/state.js`: estado principal do Orcamento e cache de elementos DOM.
- `js/data.js`: `createDefaultData()`, normalizacao e migracoes do estado principal.
- `js/planejamento.js`: construcao da projecao futura.
- `js/controle.js`: Controle Mensal, pagamentos, recebimentos, fechamento do mes e saldo em conta.
- `js/dividas/`: modulo da Rota Financeira.

O projeto usa JavaScript puro com ES modules. Nao ha bundler.

## Navegacao atual

Grupo Orcamento:

- `planejamento`
- `controle`
- `parcelas`
- `custos`
- `carro`
- `fgts`
- `ferias`

Grupo Dividas:

- `divdashboard`
- `divrota`
- `divespera`
- `divradar`
- `divquitadas`
- `divrenegociacao`

Sistema:

- `ajustes`

A navegacao mobile tem abas principais para Planejamento, Controle, Dashboard de Dividas e Rota.

## Estado e Firebase

Existem dois dominios de dados que convivem:

1. Estado principal do Orcamento:
   - Armazenado em `users/{uid}/app/state`.
   - Carregado e salvo por `js/firebase.js`.
   - Fica em `state.data`, vindo de `js/state.js`.

2. Dados da Rota Financeira:
   - Subcolecoes por usuario:
     - `users/{uid}/debts`
     - `users/{uid}/debtInstallments`
     - `users/{uid}/debtPayments`
     - `users/{uid}/debtCreditors`
     - `users/{uid}/debtRenegotiations`
   - Ponte Firebase em `js/dividas/firebase.js`.
   - Estado proprio em `js/dividas/state.js`.

O modulo de dividas usa a instancia Firebase ja inicializada pelo app principal.

## Integracao Orcamento + Dividas

A integracao mais importante esta em `js/dividas/budget-integration.js`, `js/planejamento/planejamento.js` e `js/controle/controle.js`.

Fluxo:

- Uma divida pode ter `includeInBudget = true`.
- Dividas com `includeInBudget` e status diferente de `Quitada` entram no Planejamento/Controle como linhas automaticas `auto-debt-{debtId}`.
- `getDebtInstallmentsForMonth(month)` procura a primeira parcela da divida naquele mes e cria uma linha de saida.
- No Controle Mensal, ao pagar uma linha `auto-debt-*`, `confirmPaidOccurrence()` chama `markDebtInstallmentPaid()`.
- `markDebtInstallmentPaid()` atualiza a parcela em `debtInstallments` e cria/remove registro em `debtPayments`.
- `js/dividas/boot.js` deve ficar focado em carregar/renderizar Dividas; a ponte com Orcamento fica em `budget-integration.js`.
- Cancelar pagamento pelo Controle tambem reverte a parcela no modulo de dividas.

Consequencia: nao duplique manualmente uma divida no Orcamento se ela ja esta marcada para entrar no budget.

## Credores

Existem credores do Orcamento e credores da Rota Financeira.

- Orcamento: `state.data.creditors`.
- Dividas: `js/dividas/state.js` em `state.creditors`, persistidos em `debtCreditors`.

Ha um fluxo de unificacao:

- Dialog `divUnifyCreditorDialog` no `index.html`.
- Funcoes em `js/dividas/creditors.js`.
- O botao de unificar troca as dividas de um credor da Rota para um credor do Orcamento e remove o registro antigo de `debtCreditors`.

Antes de criar credor novo em Dividas, verifique se ele deveria ser um credor do Orcamento.

## Status de dividas

Status principais:

- `Ativa`: entra na Rota Financeira.
- `Em espera`: reconhecida, mas fora da frente principal.
- `Fora do radar`: arquivada/fora do acompanhamento ativo.
- `Quitada`: encerrada.
- `Renegociada`: divida original consolidada em uma renegociacao.

Consignados CLT podem aparecer separados na Rota, pois ja sao descontados em folha e nao devem inflar o compromisso mensal normal.

## Modulo `js/dividas`

Arquivos relevantes:

- `boot.js`: carrega dados, renderiza o modulo e expoe integracao com Orcamento.
- `state.js`: estado interno das dividas.
- `firebase.js`: helpers das colecoes Firestore.
- `calc.js`: calculos de saldo, progresso, parcelas abertas, quitacao e status.
- `dashboard.js`: dashboard estrategico de dividas.
- `trail.js`: Rota Financeira e ordenacao da frente de quitacao.
- `debts.js`: listas de espera, fora do radar, quitadas e componentes de divida.
- `debt-form.js`: cadastro/edicao de dividas e geracao de parcelas.
- `payment.js`: pagamentos, quitacao e edicao de parcelas.
- `renegotiation.js`: consolidacao/renegociacao.
- `creditors.js`: credores de divida e unificacao com Orcamento.
- `data.js`: import/export, limpeza e exclusoes.
- `utils.js`: formatacao, DOM helpers e logos.

## Cuidados antes de alterar

- Nao mexa em `CONTEXTO.md` como fonte unica de verdade: ele e historico e longo. Use este arquivo para contexto atual.
- Nao quebre a ponte `auto-debt-*`; ela e o acoplamento principal entre Controle Mensal e Rota Financeira.
- Nao mova dados de dividas para `state.data` sem planejar migracao.
- Nao altere nomes de status sem ajustar filtros, renderizadores e persistencia.
- Nao remova dialogs inline do `index.html` sem revisar os handlers `window.*` usados pelo modulo de dividas.
- Preserve compatibilidade com dados ja salvos no Firebase.

## Validacao recomendada

Depois de alterar codigo:

```powershell
node --check js/app.js
node --check js/<modulo-alterado>.js
git diff --check
```

Se mexer em `js/dividas`, rode `node --check` no arquivo alterado e, quando possivel, valide no navegador:

- abrir Dashboard Dividas;
- abrir Rota Financeira;
- cadastrar/editar uma divida;
- marcar `Incluir parcela do mes no controle mensal`;
- confirmar que a parcela aparece no Controle Mensal;
- pagar/cancelar pelo Controle e conferir se a parcela da divida mudou junto.

## Estado atual do Git observado

Em 2026-06-03, `main` estava alinhada com `origin/main`.

Arquivos nao versionados observados:

- `.claude/`
- `mockup-*.html`

Eles parecem material auxiliar/local do desenvolvimento no Claude. Nao incluir automaticamente em commit sem revisar com o usuario.
