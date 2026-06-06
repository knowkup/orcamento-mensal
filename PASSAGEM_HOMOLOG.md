# Passagem de Contexto - Ambiente de Homologacao

Ultima atualizacao: 2026-06-06

Este documento existe para continuar o trabalho em outro computador ou com outra IA.
Leia antes de alterar arquivos, configurar Firebase ou publicar o sistema.

## Objetivo Atual

Publicar a branch `homolog` em um ambiente web separado para testar a modernizacao
antes de levar qualquer alteracao para a producao.

O ambiente de homologacao nao deve alterar a branch `main`, a URL de producao nem o
banco Firebase usado atualmente.

## Estado do Git

- Repositorio: `https://github.com/knowkup/orcamento-mensal.git`
- Branch de producao: `main`
- Commit atual da producao: `891e916`
- Branch de homologacao: `homolog`
- Commit base da modernizacao: `d4418c0`
- Commit que criou este documento: `ea9de0d`
- Para o commit mais recente, sempre consultar `origin/homolog`.
- A antiga branch `codex/modernizacao-segura` foi renomeada para `homolog` e removida do remoto.
- A branch `homolog` ja foi publicada no GitHub.
- As alteracoes ainda nao foram mescladas na `main`.

## Verificacao Obrigatoria No Outro Computador

Antes de alterar, sincronizar, configurar Firebase ou fazer deploy, confirmar que o
Codex esta trabalhando na copia oficial do projeto.

Executar:

```powershell
Get-Location
git rev-parse --show-toplevel
git remote -v
git status --short --branch
git log -3 --oneline
git worktree list
```

O caminho esperado deve terminar em:

```text
OneDrive\Documentos\14. Sistemas Kupka\Orcamento Mensal
```

O remoto esperado e:

```text
https://github.com/knowkup/orcamento-mensal.git
```

A branch correta para este trabalho e:

```text
homolog
```

O commit remoto minimo esperado ao receber este documento e o commit que contem
`PASSAGEM_HOMOLOG.md`. Conferir `origin/homolog` antes de continuar.

Se o caminho apontar para `.claude\worktrees`, outra copia, uma pasta antiga ou um clone
diferente, nao editar arquivos nessa pasta. Voltar para a pasta oficial do OneDrive.

Se `git status` mostrar arquivos modificados ou nao rastreados:

- nao executar `git reset`;
- nao executar `git clean`;
- nao apagar ou sobrescrever arquivos;
- nao trocar de branch ainda;
- mostrar ao usuario a saida completa do status;
- identificar se as mudancas pertencem ao usuario antes de sincronizar.

Se a pasta estiver correta e a arvore estiver limpa, executar:

```powershell
git fetch origin
git switch homolog
git pull --ff-only origin homolog
git status --short --branch
```

Depois, confirmar:

```powershell
git rev-parse HEAD
git rev-parse origin/homolog
```

Os dois hashes devem ser iguais. O resultado esperado e uma arvore limpa acompanhando
`origin/homolog`.

Existe historico de um worktree antigo criado por outra IA dentro de `.claude/worktrees`.
Ele nao deve ser usado como pasta principal. O trabalho commitado relevante desse
worktree ja foi incorporado ao historico da branch `homolog`.

## Producao Atual

- Hospedagem: GitHub Pages
- URL: `https://kupka1988.github.io/orcamento-mensal/`
- Firebase de producao: `orcamento-mensal-fdc1a`
- A producao nao deve ser modificada durante a configuracao da homologacao.

## Decisao Sobre Autenticacao

O projeto atual nao usa mais Firebase Authentication.

Consequencias:

- Nao ativar Authentication no novo projeto de homologacao.
- O app acessa diretamente o Firestore.
- As regras antigas por usuario autenticado nao representam mais a arquitetura atual.
- Sem autenticacao, regras abertas deixam o banco acessivel para quem conhecer a URL/configuracao.
- Por isso, nao usar dados financeiros reais na homologacao.

## Novo Projeto Firebase

Projeto criado para homologacao:

```text
orcamento-mensal-homolog
```

O projeto deve ter:

1. Cloud Firestore.
2. Um aplicativo Web registrado.
3. Firebase Hosting.
4. Nenhum provedor de Authentication.

Regiao recomendada para o Firestore:

```text
southamerica-east1 (Sao Paulo)
```

## Passo Exato Em Que Paramos

No Firebase Console do projeto `orcamento-mensal-homolog`:

1. Criar o Firestore Database em modo de producao.
2. Registrar um aplicativo Web com o apelido `Orcamento Mensal Homolog`.
3. Marcar a configuracao do Firebase Hosting, se essa opcao aparecer.
4. Copiar o bloco completo `firebaseConfig` exibido pelo Firebase.
5. Colar esse bloco na conversa com a IA no outro computador.

Formato esperado:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "orcamento-mensal-homolog",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

O bloco de configuracao do aplicativo Web identifica o projeto Firebase. Ele sera usado
para fazer a branch `homolog` conectar ao Firestore de homologacao, em vez do banco real
de producao.

Nao colar senha, chave de conta de servico, arquivo JSON administrativo ou credencial
privada. O solicitado e somente o bloco `firebaseConfig` do aplicativo Web.

## Por Que Esse Bloco E Necessario

O arquivo atual `firebase-config.js` aponta para o projeto de producao:

```text
orcamento-mensal-fdc1a
```

Se a homologacao for publicada sem trocar essa configuracao:

- a URL sera diferente;
- mas o sistema continuara lendo e gravando os dados reais de producao;
- testes de criar, editar, pagar ou excluir dividas poderao alterar dados reais.

O novo `firebaseConfig` permite isolar:

- site de homologacao;
- Firestore de homologacao;
- dados usados nos testes.

## Alerta Sobre As Regras Atuais

O arquivo `firestore.rules` existente ainda contem a regra antiga baseada em:

```text
users/{userId}
request.auth
```

O codigo atual grava diretamente nestes caminhos:

```text
app/state
debts
debtInstallments
debtPayments
debtCreditors
debtRenegotiations
```

Portanto, nao publicar o arquivo `firestore.rules` atual no projeto novo sem antes
atualiza-lo para a arquitetura sem autenticacao.

Para homologacao temporaria, a configuracao inicial discutida foi permitir leitura e
gravacao no banco inteiro. Isso deve ser tratado como ambiente de teste sem dados reais,
nao como configuracao segura de producao.

## O Que Ja Foi Modernizado

Todo o trabalho abaixo esta apenas na branch `homolog`:

- Testes de regras financeiras puras.
- Regras de impostos extraidas para dominio.
- Regras de saldo, parcelas e quitacao de dividas testadas.
- Gravacoes Firebase serializadas para evitar perda em salvamentos rapidos.
- Exportacao, importacao e exclusao de dados sem handlers globais estaticos.
- Renegociacao e expansao de dividas com eventos delegados.
- Ordenacao e arraste da Rota Financeira modularizados.
- Pagamentos, parcelas e quitacao sem handlers inline.
- Cadastro de dividas e credores modularizado.
- Acoes dinamicas das listas e dashboard convertidas para `data-*`.
- Handlers inline removidos do modulo Dividas.
- Testes estruturais impedem a volta de handlers inline e APIs globais.

Validacao automatizada atual:

```text
21 testes aprovados
0 testes falhando
```

O unico global mantido intencionalmente no modulo e `window.showDividasView`, usado como
ponte com a navegacao principal do sistema.

## O Que Falta Fazer Depois De Colar O Firebase Config

A IA deve:

1. Confirmar que esta na branch `homolog`.
2. Verificar que a arvore Git esta limpa.
3. Preparar configuracao separada do Firebase para homologacao.
4. Atualizar as regras de homologacao para a arquitetura atual sem Authentication.
5. Criar `firebase.json` e `.firebaserc`, se forem necessarios.
6. Configurar o Firebase Hosting sem alterar a producao no GitHub Pages.
7. Publicar a branch `homolog`.
8. Informar a URL `web.app` gerada.
9. Atualizar este documento e o checklist de homologacao.
10. Fazer commit e push somente na branch `homolog`.

## Homologacao Manual Depois Da Publicacao

Antes de testar fluxos destrutivos, confirmar que a URL publicada aponta para:

```text
projectId: orcamento-mensal-homolog
```

Testar especialmente:

- Todas as abas de Dividas carregam.
- Criar e editar divida.
- Registrar e excluir pagamento.
- Quitar divida.
- Mover entre Rota, Em Espera e Fora do Radar.
- Ordenar com seletor, setas e arraste.
- Criar, editar, excluir e unificar credores.
- Recarregar a pagina e confirmar persistencia.
- Fazer duas alteracoes rapidamente e confirmar que ambas permanecem.

Usar dados ficticios na homologacao.

## Proximo Trabalho Estrutural Depois Da Homologacao

Depois de aprovar este pacote, o proximo ganho estrutural planejado e remover a
duplicacao entre:

```text
js/dividas/debts.js
js/dividas/trail.js
```

Os principais trechos duplicados sao:

- menu de acoes da divida;
- lista e abas de parcelas;
- detalhes expandidos;
- composicao visual das linhas.

Essa refatoracao nao deve comecar antes de confirmar que o pacote atual funciona no
ambiente publicado de homologacao.
