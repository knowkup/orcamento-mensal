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

## Mudancas feitas

- Criado arquivo de contexto inicial.
- Criado `CONTEXTO_CODEX.md`.
- Criado `.gitignore`.
- Criada pasta local `backups/`.
- Inicializado Git local na branch `main`.
- Configurado usuario Git local como `Codex <codex@local>`.
- Observado arquivo nao versionado `Orcamento mensal.xlsx`/`Orçamento mensal.xlsx`; ele nao foi alterado nem incluido no commit inicial.
- Criado commit inicial da estrutura do projeto.
- Verificado que ainda nao existe remoto Git configurado; push nao executado.

## Backups criados

- Nenhum backup ainda; a pasta inicial estava vazia.

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

## Pendencias

- Configurar remoto GitHub quando existir.
- Fazer push para `origin/main` quando o remoto estiver configurado.
- Decidir posteriormente se a planilha existente deve ser versionada, migrada, importada ou mantida apenas como dado local.

## Proximos passos

- Configurar o remoto GitHub `origin` quando o repositorio existir.
- Fazer push para `origin/main` apos configurar o remoto.
