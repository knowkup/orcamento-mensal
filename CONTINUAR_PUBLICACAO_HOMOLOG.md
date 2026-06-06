# Continuar Publicacao Da Homologacao

Data: 2026-06-06

Este documento deve ser lido integralmente pelo Codex no outro computador.
O objetivo e concluir o push da branch `homolog` e publicar o Firebase Hosting de
homologacao sem alterar a producao.

## Regra Principal

Nao trabalhar na `main`.
Nao usar `git reset`, `git clean`, `checkout --` ou qualquer comando destrutivo.
Nao apagar mudancas locais sem entender de qual computador ou IA elas vieram.

## Estado Esperado

Repositorio:

```text
https://github.com/knowkup/orcamento-mensal.git
```

Pasta oficial:

```text
OneDrive\Documentos\14. Sistemas Kupka\Orcamento Mensal
```

Branch de trabalho:

```text
homolog
```

Commit de configuracao criado neste computador:

```text
5f04cae Configura ambiente Firebase de homologacao
```

Esse commit passou em 23 testes, mas nao chegou ao GitHub porque o Git Credential
Manager deste computador falhou. No momento da criacao deste documento:

```text
HEAD local: 5f04cae
origin/homolog: 8c30b40
```

O OneDrive pode sincronizar o commit, os arquivos ou ambos para o outro computador.
Por isso, primeiro diagnosticar o estado real.

Este proprio documento pode aparecer em um commit posterior a `5f04cae`. Nesse caso,
o importante e confirmar que `5f04cae` esta no historico:

```powershell
git log --oneline --all | Select-String 5f04cae
```

## Passo 1 - Confirmar A Pasta

Executar:

```powershell
Get-Location
git rev-parse --show-toplevel
git remote -v
git worktree list
```

Se o caminho contiver `.claude\worktrees`, parar. Essa nao e a pasta oficial.

O remoto deve ser:

```text
https://github.com/knowkup/orcamento-mensal.git
```

## Passo 2 - Diagnosticar Git Sem Alterar Nada

Executar:

```powershell
git status --short --branch
git log -5 --oneline --decorate
git rev-parse HEAD
git rev-parse origin/homolog
```

### Cenario A - `5f04cae` ja esta no historico local

Se aparecer no log:

```text
5f04cae Configura ambiente Firebase de homologacao
```

e a arvore estiver limpa, ou apenas este documento estiver em um commit posterior,
executar:

```powershell
git push origin homolog
```

Depois confirmar:

```powershell
git fetch origin
git rev-parse HEAD
git rev-parse origin/homolog
```

Os hashes devem ser iguais.

### Cenario B - Os arquivos estao modificados, mas o commit nao existe

Esperar estes arquivos:

```text
.firebaserc
CONTINUAR_PUBLICACAO_HOMOLOG.md
PASSAGEM_HOMOLOG.md
docs/CHECKLIST_HOMOLOGACAO.md
firebase-config.js
firebase.json
firebase.md
firestore.rules
test/firebase-environment.test.js
```

Revisar sem sobrescrever e executar:

```powershell
npm test
node --check firebase-config.js
Get-Content firebase.json -Raw | ConvertFrom-Json | Out-Null
Get-Content .firebaserc -Raw | ConvertFrom-Json | Out-Null
git diff --check
```

O resultado esperado e:

```text
23 testes aprovados
0 testes falhando
```

Se estiver tudo correto:

```powershell
git add .firebaserc CONTINUAR_PUBLICACAO_HOMOLOG.md PASSAGEM_HOMOLOG.md docs/CHECKLIST_HOMOLOGACAO.md firebase-config.js firebase.json firebase.md firestore.rules test/firebase-environment.test.js
git commit -m "Configura ambiente Firebase de homologacao"
git push origin homolog
```

### Cenario C - Nem o commit nem os arquivos aparecem

Nao recriar de memoria.
Esperar o OneDrive concluir a sincronizacao e reler este documento.

## Configuracao Que Deve Existir

`firebase-config.js` deve conter os dois projetos:

```text
producao: orcamento-mensal-fdc1a
homologacao: orcamento-mensal-homolog
```

A escolha deve ocorrer pela URL:

```text
orcamento-mensal-homolog.web.app -> homologacao
orcamento-mensal-homolog.firebaseapp.com -> homologacao
localhost / 127.0.0.1 -> homologacao
kupka1988.github.io -> producao
```

`.firebaserc` deve apontar exclusivamente para:

```text
orcamento-mensal-homolog
```

`firestore.rules` esta temporariamente aberto porque o projeto nao usa Authentication.
Usar apenas dados ficticios na homologacao.

## Passo 3 - Confirmar Firebase Console

Antes do deploy, confirmar no Firebase Console:

1. Projeto selecionado: `orcamento-mensal-homolog`.
2. Firestore Database criado.
3. Aplicativo Web registrado.
4. Authentication nao ativado.
5. Hosting disponivel no projeto.

## Passo 4 - Autenticar Firebase CLI

Executar:

```powershell
npx --yes firebase-tools login
```

Concluir o login no navegador com a conta que administra
`orcamento-mensal-homolog`.

Depois:

```powershell
npx --yes firebase-tools projects:list
```

Confirmar que `orcamento-mensal-homolog` aparece na lista.

## Passo 5 - Publicar Regras E Hosting

Na pasta oficial e na branch `homolog`, executar:

```powershell
npx --yes firebase-tools deploy --only firestore:rules,hosting --project orcamento-mensal-homolog
```

Nao executar deploy usando `orcamento-mensal-fdc1a`.

O resultado esperado inclui uma URL semelhante a:

```text
https://orcamento-mensal-homolog.web.app
```

## Passo 6 - Validacao Imediata

Abrir:

```text
https://orcamento-mensal-homolog.web.app
```

Confirmar:

1. O app carrega.
2. O status do Firebase fica sincronizado.
3. Dados reais de producao nao aparecem.
4. Criar um registro ficticio.
5. Recarregar e confirmar persistencia.
6. Apagar o registro ficticio, se o fluxo permitir.

Depois seguir:

```text
docs/CHECKLIST_HOMOLOGACAO.md
```

## Passo 7 - Registrar O Resultado

Atualizar `PASSAGEM_HOMOLOG.md` com:

- data do deploy;
- URL publicada;
- resultado do deploy de regras;
- resultado dos testes iniciais;
- problemas encontrados.

Depois:

```powershell
git add PASSAGEM_HOMOLOG.md docs/CHECKLIST_HOMOLOGACAO.md
git commit -m "Registra publicacao da homologacao"
git push origin homolog
```

## Alerta Sobre A Main

O arquivo `firebase.md` foi enviado acidentalmente para a `main` pelo GitHub Web no
commit:

```text
28148aa Add files via upload
```

Esse commit adicionou somente `firebase.md` e nao mudou o aplicativo em producao.
Nao misturar a `main` com a `homolog` durante o deploy.

A remocao posterior desse arquivo da `main` deve ser feita em uma operacao separada,
depois que a homologacao estiver publicada.

## Resultado A Informar Ao Usuario

Ao terminar, informar de forma objetiva:

- hash publicado em `origin/homolog`;
- URL da homologacao;
- se regras e Hosting foram publicados;
- quantidade de testes aprovados;
- qualquer etapa que ainda dependa de acao manual.
