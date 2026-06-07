# CLAUDE.md - Orcamento Mensal

Instrucoes permanentes para agentes trabalhando neste projeto.

## Regra principal

Antes de alterar codigo, entenda o contexto atual do produto em `CONTEXTO_ATUAL.md`.

Este app mudou bastante: o antigo Orcamento Mensal foi unificado com a Rota Financeira de Dividas. Nao trate o projeto como um app simples de orcamento nem como dois produtos separados.

## Fluxo de trabalho

1. Analisar os arquivos relevantes antes de propor mudanca.
2. Explicar quais arquivos serao alterados e por que.
3. Fazer mudancas pequenas e rastreaveis.
4. Validar com `node --check` nos modulos alterados e `git diff --check`.
5. Revisar o diff antes de concluir.
6. Commitar com mensagem clara e fazer push para `origin main` quando a tarefa estiver fechada.

Se houver ambiguidade de produto, pergunte antes de modelar. A planilha original e o uso real do Felipe valem mais do que uma abstracao generica.

## Principios

- Simplicidade primeiro: sem stack nova, bundler ou framework sem pedido explicito.
- Mudancas cirurgicas: nao refatorar codigo adjacente sem necessidade.
- Preservar dados existentes e compatibilidade com Firebase.
- Nao reverter alteracoes locais que voce nao fez.
- Manter Git organizado, com commits pequenos e intencionais.

## Stack e deploy

- HTML, CSS e JavaScript puro com ES modules.
- Firebase Auth e Firestore.
- GitHub Pages publica a branch `main`.
- Repositorio: `knowkup/orcamento-mensal`.
- Pasta oficial: OneDrive, `14. Sistemas Kupka/Orcamento Mensal`.

## Padroes de UI

- Icones via Lucide (`<i data-lucide="nome">` + `refreshIcons()`).
- Modais com `<dialog class="dialog">` e `.showModal()`.
- Tabelas com `.data-table`.
- Dono/titular com `<span class="owner-pill">`.
- Mobile importa: evitar overflow, clipping e botoes grandes demais.
