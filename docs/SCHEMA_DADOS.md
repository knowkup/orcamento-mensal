# Schema de Dados

Ultima atualizacao: 2026-06-06

## Estado principal

O Orcamento e salvo no documento Firestore `app/state` e na chave local
`orcamento-mensal-state-v2`.

Campos principais:

- `schemaVersion`: versao estrutural atual, hoje `3`.
- `updatedAt`: revisao numerica usada para ordenar a sincronizacao.
- `creditors`: catalogo compartilhado de credores.
- `creditCards`: cartoes e crediarios vinculados a credores.
- `incomeLines`: entradas manuais planejadas.
- `recurringIncomes`: rendas recorrentes e historico de alteracoes.
- `projectionLines`: linhas configuradas da projecao.
- `installments`: parcelamentos do Orcamento.
- `fixedCosts`: custos fixos.
- `plannedPurchases`: saidas manuais planejadas.
- `paidOccurrences` e `receivedOccurrences`: baixas por chave `linha:AAAA-MM`.
- `paidAmounts`, `paidDates` e `receivedAmounts`: detalhes das baixas.
- `appliedCashMovements`: movimentos ja aplicados ao saldo em conta.
- `fixedCostAmountOverrides`: valores excepcionais por custo e mes.
- `car`, `fgts`, `vacations` e `taxes`: dominios especializados.

## Dividas

Dividas permanecem em colecoes separadas:

- `debts`
- `debtInstallments`
- `debtPayments`
- `debtRenegotiations`

O catalogo de credores nao e duplicado nessas colecoes. As dividas guardam
`creditorId`, que referencia `state.data.creditors`.

## Sincronizacao

Cada salvamento do estado principal recebe uma revisao monotonicamente crescente.
Enquanto uma gravacao local esta pendente, snapshots de nuvem com revisao inferior
sao ignorados. Isso impede que uma versao antiga restaure um item acabado de excluir.

Depois que a fila termina, alteracoes legitimas de outro computador voltam a ser
aceitas normalmente.

## Backup

O backup atual usa um envelope versionado:

```json
{
  "backupFormat": "orcamento-mensal",
  "backupVersion": 1,
  "exportedAt": "2026-06-06T12:00:00.000Z",
  "data": {
    "schemaVersion": 3
  }
}
```

Backups antigos que continham diretamente o estado de schema 3 continuam aceitos.
Antes da importacao, o arquivo e validado, resumido e exige confirmacao porque
substitui o estado principal.

## Regras de compatibilidade

- Nunca reutilizar identificadores de registros excluidos.
- Migracoes precisam ser idempotentes.
- Campos novos devem possuir valor padrao em `createDefaultData()`.
- `normalizeData()` deve aceitar dados anteriores ainda suportados.
- Consignado CLT deve persistir `includeInBudget = false`.
- Exclusao de lancamento manual deve remover baixas e reverter seu movimento de caixa.
