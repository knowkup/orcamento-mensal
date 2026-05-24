# CONTEXTO_CODEX

Este arquivo registra o contexto operacional usado pelo Codex no projeto `Orcamento Mensal`.

## Regras principais

- Usar a pasta oficial do OneDrive como origem de trabalho.
- Ler e atualizar `CONTEXTO.md` antes e depois das tarefas.
- Criar backups em `backups/YYYYMMDD-HHMMSS` antes de mudancas relevantes.
- Nao versionar backups.
- Manter mudancas pequenas, rastreaveis e alinhadas com a estrutura existente.
- Validar com `node --check app.js` quando houver JavaScript.
- Rodar `git diff --check` antes de concluir.
- Revisar `git diff` antes de commit.
- Fazer commit ao alterar arquivos do projeto.
- Fazer push para `origin/main` quando o remoto existir.

## Stack preferida inicial

- `index.html`
- `styles.css`
- `app.js`

## UX

- Mobile primeiro.
- Layout claro, compacto e operacional.
- Linguagem simples e humana.
- Evitar botoes sem implementacao.
- Evitar `alert()` e `confirm()` quando for possivel usar modal ou toast proprio.

## Dados

- Nao apagar, sobrescrever ou recriar dados sem confirmacao explicita.
- Qualquer integracao Firebase deve ser documentada antes de publicacao de regras.
