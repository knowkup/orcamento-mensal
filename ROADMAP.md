# Roadmap — Orçamento Mensal

Itens planejados para sprints futuras. Nao implementar sem alinhamento previo.

---

## Dashboard (nova aba)

Objetivo: visao analitica e indicadores do orcamento.

Ideias mapeadas:
- Somatorio por grupo/categoria
- Distribuicao de gastos (grafico pizza ou barras)
- Evolucao financeira ao longo dos meses
- Indicadores por categoria
- Projecoes gerais
- Comparativo previsto x realizado

Dependencia: core (Controle Mensal, Parcelamentos, Custos Fixos) validado com dados reais primeiro.

---

## Saldos e Limites pessoais

Objetivo: evoluir a logica de limites por pessoa (ja existe `kahLimit`).

Exemplo de comportamento esperado:
- Limite Kah: R$ 1.000
- Gasto previsto atual: R$ 840 (84% utilizado)
- Alerta visual quando ultrapassar o limite

Pode ser feito junto com o Dashboard ou em sprint intermediaria.

---

## Firebase / Login

Objetivo: simplificar o login sem perder dados nem sincronizacao.

Problema relatado: login sendo solicitado com frequencia.

Abordagem recomendada (executar em ordem):
1. Verificar/fixar `browserLocalPersistence` explicito em `firebase.js`
   — zero risco, nenhum impacto nos dados
2. Tornar `onAuthStateChanged` mais robusto para reconexao silenciosa
3. Se o problema persistir: avaliar login por link de email (passwordless)
4. Alternativa arquitetural (alto risco, ultima opcao): offline-first com sync manual

Antes de implementar: Claude deve confirmar a abordagem com o usuario.

---

_Ultima atualizacao: 2026-05-26_
