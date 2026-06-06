# Passagem de Contexto - Homologacao

Ultima atualizacao: 2026-06-06

Leia este documento antes de publicar ou continuar o trabalho em outro computador.

## Decisao De Infraestrutura

O codigo e as duas publicacoes ficam no GitHub:

- producao: branch `main`;
- homologacao: branch `homolog`;
- producao publicada em `https://knowkup.github.io/orcamento-mensal/`;
- homologacao publicada em `https://knowkup.github.io/orcamento-mensal/homolog/`.

O Firebase nao hospeda o site. Ele e usado somente como banco Firestore:

- producao: projeto `orcamento-mensal-fdc1a`;
- homologacao: projeto `orcamento-mensal-homolog`.

O workflow `.github/workflows/pages.yml` monta as duas branches em um unico artefato
do GitHub Pages. A raiz recebe a `main` e a pasta `/homolog/` recebe a `homolog`.

## Regra De Seguranca

A URL de homologacao deve selecionar o projeto Firebase
`orcamento-mensal-homolog`. Nunca homologar alteracoes usando os dados reais.

O arquivo `firebase-config.js` seleciona o ambiente pela URL:

```text
https://knowkup.github.io/orcamento-mensal/          -> producao
https://knowkup.github.io/orcamento-mensal/homolog/ -> homologacao
localhost / 127.0.0.1                                 -> homologacao
```

## Estado Do Pacote

Pacote funcional enviado para `origin/homolog`:

- `7535a8c` - unifica credores e protege consignados;
- `b29034f` - registra o pacote para homologacao.

Alteracoes principais:

- catalogo unico de credores para Orcamento e Dividas;
- migracao automatica dos antigos documentos de `debtCreditors`;
- bloqueio de exclusao de credor usado por dividas;
- backup de Dividas compativel com o catalogo compartilhado;
- limpeza de Dividas sem apagar credores globais;
- Consignado CLT nunca entra no Controle Mensal;
- remocao da interface duplicada de credores de Dividas.

Pacote estrutural seguinte:

- detalhes expandidos, menu de acoes e parcelas agora possuem um unico renderizador;
- linhas da Rota e de Consignado usam um componente visual compartilhado;
- regras de ordenacao, arraste, filtros e persistencia permanecem nos modulos originais.
- persistencia de ordem e ciclo comum de arraste foram centralizados para Rota,
  Em Espera e Fora do Radar.

Validacao automatizada anterior:

```text
27 testes aprovados
0 testes falhando
```

## Publicacao

O workflow publica automaticamente quando houver push em `main` ou `homolog`.

Caso o GitHub Pages ainda esteja configurado para publicar diretamente de uma branch,
abrir:

```text
GitHub > Settings > Pages > Build and deployment > Source
```

Selecionar:

```text
GitHub Actions
```

Depois executar novamente o workflow `Publicar producao e homologacao`, se necessario.

## Verificacao Em Outro Computador

Executar:

```powershell
Get-Location
git rev-parse --show-toplevel
git remote -v
git status --short --branch
git log -3 --oneline
```

Pasta esperada:

```text
OneDrive\Documentos\14. Sistemas Kupka\Orcamento Mensal
```

Repositorio esperado:

```text
https://github.com/knowkup/orcamento-mensal.git
```

Para continuar a homologacao:

```powershell
git fetch origin
git switch homolog
git pull --ff-only origin homolog
```

Nao usar copias dentro de `.claude/worktrees` como pasta principal. Nao executar
`git reset`, `git clean` ou descartar alteracoes locais sem primeiro identificar sua
origem.

## Homologacao Manual

Abrir:

```text
https://knowkup.github.io/orcamento-mensal/homolog/
```

Confirmar:

1. A aplicacao carrega e sincroniza.
2. O projeto selecionado e `orcamento-mensal-homolog`.
3. Nenhum dado real de producao aparece.
4. Credores aparecem iguais em Preferencias e Dividas.
5. Dividas antigas continuam vinculadas aos credores depois da migracao.
6. Credor usado por uma divida nao pode ser excluido.
7. Consignado CLT desmarca e bloqueia a inclusao no Controle Mensal.
8. Consignado CLT nao aparece no Controle Mensal depois da recarga.
9. Exportacao e importacao de backup de Dividas preservam os credores.

Continuar com `docs/CHECKLIST_HOMOLOGACAO.md`.

## Producao

Nao mesclar a modernizacao na `main` antes da aprovacao manual. O workflow de Pages
pode existir nas duas branches sem levar o restante da modernizacao para producao.
