# Plano de Evolucao do Orcamento Mensal

Documento vivo para orientar a evolucao do sistema entre computadores, GitHub e OneDrive.

Ultima atualizacao: 2026-06-05

---

## Contexto

O sistema nasceu como dois projetos separados:

- Orcamento Mensal: controle de receitas, despesas, parcelamentos, custos fixos, carro, FGTS e planejamento mensal.
- Dividas: controle de dividas, rota de quitacao, pagamentos, renegociacoes e credores.

Depois, os dois projetos foram unificados em uma unica aplicacao web. Isso explica algumas diferencas internas de arquitetura, estilo visual, persistencia e padroes de codigo.

O sistema e usado em producao para uso pessoal, principalmente via web, com sincronizacao em outros locais por Firebase/Firestore. A ideia nao e escalar para muitos usuarios, e sim ter um sistema pessoal confiavel, profissional e melhor que uma planilha Excel avancada.

---

## Objetivo

Evoluir o sistema com inteligencia, sem destruir o que funciona.

O objetivo principal e melhorar:

- Confiabilidade dos dados.
- Experiencia de uso no dia a dia.
- Consistencia visual entre Orcamento e Dividas.
- Manutenibilidade do codigo.
- Clareza dos fluxos financeiros.
- Sincronizacao entre computadores.

Nao e objetivo:

- Criar um produto SaaS.
- Escalar para muitos usuarios.
- Reescrever tudo de uma vez.
- Trocar stack por moda.
- Criar um backend proprio.
- Transformar o projeto em algo dificil de manter.

---

## Principios de Trabalho

1. O sistema atual e producao.
   - Qualquer mudanca deve respeitar o uso diario.
   - Nao quebrar fluxos essenciais.

2. Nada grande sem autorizacao explicita.
   - Refatoracoes profundas, mudancas de tela e alteracoes de dados precisam de alinhamento antes.

3. Evolucao incremental.
   - Uma area por vez.
   - Mudancas pequenas.
   - Validacao real pelo uso.

4. Preservar comportamento antes de melhorar arquitetura.
   - Primeiro entender.
   - Depois testar.
   - Depois refatorar.

5. Firebase continua sendo a base de sincronizacao.
   - O app precisa continuar acessivel em mais de um computador.
   - O modelo web atual continua fazendo sentido.

6. Profissionalizar sem empresarializar.
   - Melhorar qualidade, UX e confiabilidade.
   - Evitar complexidade desnecessaria.

---

## Stack Atual

### Mantida por enquanto

- HTML estatico.
- CSS unico.
- JavaScript moderno com ES Modules.
- Firebase/Firestore via CDN.
- Lucide icons via CDN.
- PWA basico via manifest.
- Deploy estatico via GitHub Pages.

### Observacoes

- Nao existe build tool obrigatorio.
- Nao existe framework frontend.
- Nao existe TypeScript.
- Nao existe suite formal de testes.
- O projeto esta simples de publicar e operar.

Isso e uma vantagem para um sistema pessoal. A stack atual nao deve ser substituida sem motivo forte.

---

## Diagnostico Atual

### Pontos fortes

- App ja e modularizado por dominios principais.
- Funciona como web app pessoal e sincronizado.
- Firebase atende bem ao uso multi-computador.
- Ha separacao inicial por pastas: planejamento, controle, dividas, FGTS, carro, ferias etc.
- A experiencia ja esta muito acima de uma planilha.
- Existe PWA basico e navegacao mobile.
- A logica de dividas ja tem indices em memoria para consultas internas.

### Pontos fracos

- Orcamento e Dividas ainda parecem duas arquiteturas unidas.
- Ha diferencas de UX, padroes visuais e estrutura entre modulos.
- `index.html` concentra muitas telas e dialogs.
- `styles.css` concentra estilos demais.
- Alguns modulos JavaScript estao grandes demais.
- Ha muito uso de `innerHTML` e rebinding de eventos.
- Em Dividas ainda ha muitos handlers via `window.*` e `onclick`.
- O render global redesenha muitas areas mesmo quando so uma parte mudou.
- Regras financeiras criticas ainda nao tem testes formais.
- O modelo de persistencia e diferente entre Orcamento principal e Dividas.

---

## Estrategia Recomendada

Nao criar uma versao paralela completa.

O melhor caminho e evoluir o sistema atual aos poucos, com ilhas novas quando fizer sentido.

### Quando mexer direto no atual

Usar para:

- Ajustes visuais pequenos.
- Padronizacao de botoes/cards/modais.
- Correcao de inconsistencias.
- Refatoracoes internas sem mudar comportamento.
- Melhorias em sincronizacao e backup.
- Extracao de utilitarios duplicados.

### Quando criar versao experimental paralela

Usar apenas para uma tela ou fluxo especifico, nunca para o sistema inteiro.

Exemplos:

- Nova versao do Controle Mensal.
- Nova tela de Hoje/Agora.
- Nova experiencia mobile da Rota Financeira.

Fluxo recomendado:

1. Criar tela experimental escondida ou opcional.
2. Usar por alguns dias.
3. Comparar com a tela atual.
4. Substituir apenas quando houver confianca.
5. Manter fallback temporario.
6. Remover legado depois.

---

## Fluxos Criticos Que Nao Podem Quebrar

Antes de qualquer mudanca maior, estes fluxos precisam ser preservados:

- Abrir o app e carregar dados.
- Sincronizar com Firebase.
- Exportar backup JSON.
- Importar backup JSON.
- Registrar recebimento.
- Cancelar recebimento.
- Registrar pagamento.
- Cancelar pagamento.
- Fechar mes.
- Criar/editar/excluir parcelamento.
- Criar/editar/excluir custo fixo.
- Criar/editar/excluir credor.
- Criar/editar/excluir cartao.
- Criar/editar/excluir renda.
- Criar/editar/excluir divida.
- Registrar pagamento de divida.
- Quitar divida.
- Renegociar dividas.
- Integrar parcela de divida no Controle Mensal.

---

## Plano de Evolucao Incremental

### Fase 0 - Disciplina de producao

Objetivo: proteger o uso diario.

Acao:

- Sempre verificar `git status` antes de mexer.
- Fazer mudancas pequenas.
- Rodar validacoes basicas.
- Commitar com mensagens claras.
- Fazer push somente depois de validar.
- Evitar mexer em dados reais sem backup.

Validacao minima:

```bash
node --check js/app.js
node --check js/planejamento/planejamento.js
git diff --check
```

Quando mexer em outros arquivos JS, rodar `node --check` neles tambem.

---

### Fase 1 - Consolidacao pos-fusao

Objetivo: fazer Orcamento e Dividas parecerem um unico sistema.

Acao:

- Padronizar botoes.
- Padronizar cards.
- Padronizar filtros.
- Padronizar modais.
- Padronizar estados vazios.
- Padronizar mensagens de confirmacao.
- Padronizar toasts.
- Padronizar uso de moeda e data.
- Reduzir diferencas visuais entre telas de Orcamento e Dividas.

Risco: baixo a medio.

Regra: nao alterar regras financeiras nesta fase.

---

### Fase 2 - UX do uso diario

Objetivo: melhorar a experiencia real de abrir, entender, agir e sair.

Prioridades:

1. Controle Mensal.
2. Rota Financeira.
3. Planejamento.
4. Dashboard/visao de Hoje ou Agora.

Ideias:

- Criar uma visao "Hoje / Agora".
- Mostrar proximas acoes.
- Mostrar vencimentos relevantes.
- Mostrar saldo real x previsto.
- Mostrar pagamentos pendentes.
- Mostrar recebimentos pendentes.
- Dar acesso rapido para pagar, receber e ajustar valores.

Risco: medio.

Regra: se a mudanca for grande, criar tela experimental primeiro.

---

### Fase 3 - Confiabilidade dos dados

Objetivo: reduzir risco de perda, duplicidade ou confusao de dados.

Acao:

- Melhorar mensagens de sincronizacao.
- Mostrar ultima sincronizacao.
- Melhorar estados offline/online.
- Criar backup manual mais evidente.
- Validar importacao antes de substituir dados.
- Documentar schema de dados.
- Melhorar migracoes de schema.

Risco: medio.

Regra: backup antes de qualquer mudanca que toque persistencia.

---

### Fase 4 - Refatoracao segura do codigo

Objetivo: melhorar manutencao sem mudar funcionalidade.

Acao:

- Extrair regras financeiras puras para arquivos de dominio.
- Reduzir duplicacao entre `js/utils.js` e `js/dividas/utils.js`.
- Reduzir `window.*` em Dividas.
- Remover handlers inline do HTML aos poucos.
- Criar event delegation por tela.
- Reduzir render global.
- Renderizar apenas areas afetadas quando possivel.

Risco: medio.

Regra: cada refatoracao precisa preservar comportamento observavel.

---

### Fase 5 - Testes de regras criticas

Objetivo: permitir evolucao com menos medo.

Acao:

- Criar testes para calculos de:
  - Projecao mensal.
  - Parcelamentos.
  - Custos fixos.
  - Rendas recorrentes.
  - CLT/liquido.
  - Ferias.
  - Decimo terceiro.
  - Quitacao de dividas.
  - Pagamento parcial.
  - Renegociacao.

Stack possivel:

- Comecar sem framework, com scripts simples Node.
- Evoluir para Vitest se o projeto ganhar build tool.

Risco: baixo.

---

### Fase 6 - Modernizacao tecnica opcional

Objetivo: melhorar ergonomia de desenvolvimento, se fizer sentido.

Possibilidades:

- Adicionar Vite.
- Adicionar Vitest.
- Migrar partes para TypeScript.
- Empacotar Firebase em vez de usar CDN.
- Separar CSS por feature.

Nao recomendado agora:

- Migrar tudo para React de uma vez.
- Criar backend proprio.
- Reescrever toda a aplicacao.
- Criar app mobile nativo.

Risco: medio a alto.

Regra: so fazer se houver ganho claro e plano de rollback.

---

## Proposta de UX/UI

### Direcao visual

O sistema deve parecer uma ferramenta financeira pessoal profissional:

- Denso, mas escaneavel.
- Calmo, mas nao apagado.
- Direto, sem cara de landing page.
- Visualmente consistente.
- Bom para uso repetido.

### Melhorias prioritarias

1. Hierarquia visual.
   - O que e mais importante deve aparecer primeiro.
   - Acoes principais devem ser obvias.

2. Controle Mensal mais operacional.
   - Receber, pagar, ajustar e fechar mes com menos atrito.

3. Mobile mais app-like.
   - Bottom nav ja e uma boa base.
   - Melhorar modais, listas e acoes fixas.

4. Dividas mais integrada ao Orcamento.
   - Mesmo padrao visual.
   - Mesma linguagem.
   - Melhor ponte com Controle Mensal.

5. Feedback mais claro.
   - Salvando.
   - Sincronizado.
   - Offline.
   - Erro ao salvar.
   - Ultima atualizacao.

---

## Arquitetura Alvo Leve

Nao e uma arquitetura empresarial. E uma organizacao simples para um app pessoal serio.

Camadas desejadas:

```txt
js/
  app.js
  state.js
  storage.js
  firebase.js
  domain/
    projection.js
    payments.js
    debts.js
    dates.js
    money.js
  ui/
    events.js
    dialogs.js
    toast.js
    render.js
  features/
    planejamento/
    controle/
    dividas/
    preferencias/
```

Ideia:

- `domain`: regras puras, sem DOM.
- `ui`: manipulacao de tela.
- `features`: telas e fluxos.
- `storage/firebase`: persistencia.

Isso pode ser feito aos poucos, arquivo por arquivo.

---

## Codigo de Referencia

### Event delegation

Substitui varios `onclick` e varios `addEventListener` recriados apos `innerHTML`.

```js
export function delegate(root, selector, eventName, handler) {
  root.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (!target || !root.contains(target)) return;
    handler(event, target);
  });
}
```

Exemplo de uso:

```js
delegate(document.querySelector("#divrotaView"), "[data-action]", "click", (event, button) => {
  const { action, debtId } = button.dataset;

  if (action === "open-payment") openPaymentForm(debtId);
  if (action === "edit-debt") openDebtForm("edit", debtId);
  if (action === "delete-debt") openDeleteModal("debt", debtId);
});
```

---

### Repository simples

Evita que as telas saibam diretamente se os dados vem de localStorage ou Firestore.

```js
export function createBudgetRepository({ loadLocal, saveLocal, saveCloud, subscribeCloud }) {
  return {
    load() {
      return loadLocal();
    },

    async save(data) {
      saveLocal(data);
      await saveCloud(data);
    },

    subscribe(onChange) {
      return subscribeCloud(onChange);
    }
  };
}
```

---

### Store pequena por fatia

Permite atualizar so a parte afetada, em vez de renderizar tudo sempre.

```js
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    get() {
      return state;
    },

    set(nextState) {
      state = nextState;
      listeners.forEach((listener) => listener(state));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
```

---

## Criterios de Homologacao

Antes de considerar uma mudanca pronta:

- App abre sem erro.
- Dados aparecem corretamente.
- Firebase sincroniza.
- Exportacao de backup funciona.
- Fluxo alterado foi testado manualmente.
- Nenhum fluxo critico relacionado foi quebrado.
- Git esta limpo apos commit/push.

Para mudancas visuais:

- Testar desktop.
- Testar mobile.
- Conferir se texto nao sobrepoe.
- Conferir modais.
- Conferir botoes principais.

Para mudancas de dados:

- Fazer backup antes.
- Testar import/export.
- Conferir Firestore se necessario.

---

## Ordem Recomendada de Proximos Trabalhos

1. Padronizar feedback de sincronizacao e toast.
2. Melhorar visual e usabilidade do Controle Mensal.
3. Padronizar componentes visuais de Dividas com Orcamento.
4. Criar visao "Hoje / Agora".
5. Remover `onclick`/`window.*` de uma area pequena de Dividas como piloto.
6. Extrair regras puras de planejamento para arquivos de dominio.
7. Criar testes simples para calculos financeiros.
8. Avaliar Vite/Vitest somente depois que houver necessidade real.

---

## Decisoes Registradas

- O sistema continuara sendo web.
- Firebase continua sendo importante por acesso em multiplos locais.
- O sistema e pessoal; escala multiusuario nao e prioridade.
- O caminho preferido e incremental.
- Nao criar versao paralela completa.
- Criar telas experimentais apenas quando o risco justificar.
- Nao migrar para React agora.
- Stack atual deve ser evoluida, nao descartada.
- Modulos de Dividas tem imports circulares sensiveis; evitar codigo novo executando no topo dos modulos.
- Em Dividas, preferir ligar eventos dentro de funcoes chamadas apos render/boot, nunca em inicializacao de modulo sem necessidade.
- Mudancas em bindings de Dividas devem ter rollback facil e homologacao imediata nas abas Dashboard, Rota, Em Espera, Fora do Radar e Quitadas.

---

## Como Usar Este Documento

- Consultar antes de pedir mudancas grandes.
- Atualizar quando uma decisao importante mudar.
- Usar como guia entre computadores.
- Manter no Git para historico.
- Manter no OneDrive como copia local sincronizada.
