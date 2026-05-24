# Modelo Real da Planilha

Este documento registra a logica atual da planilha `Orçamento mensal.xlsx`.
Ele deve guiar qualquer nova implementacao. O app atual publicado foi considerado generico demais e nao deve ser usado como referencia de produto.

## Principio central

A planilha funciona porque a aba `Dívida Cronologia` mostra o futuro de forma pratica.

Ela nao e apenas um dashboard. Ela e uma tela operacional de simulacao mensal:

- mostra entradas futuras;
- mostra saidas futuras;
- agrupa contas por origem/cartao quando isso importa;
- permite colocar compras planejadas em meses futuros;
- mostra a sobra/falta de cada mes;
- carrega um saldo acumulado, para enxergar quando a situacao melhora ou piora.

O sistema deve preservar essa sensacao: abrir a tela principal e entender o caminho dos proximos meses.

## Abas visiveis

- `Dívida Cronologia`: tela principal, projecao futura e saldo acumulado.
- `Parcelas`: cadastro e controle de compras parceladas em cartao/origem.
- `Custo Fixo`: cadastro de custos fixos, alguns usados pela projecao principal.
- `Jeep Compass`: modulo proprio do financiamento do carro.
- `Ant.FGTS`: modulo proprio de antecipacoes/emprestimos de FGTS.

## Controle Mensal

Nome escolhido para substituir `Dívida Cronologia`: `Controle Mensal`.

A ideia e manter a funcao central da aba original, mas com um nome mais claro e menos pesado.

### Estrutura observada

Bloco superior, linhas 5 a 13:

- receitas/entradas e eventos positivos;
- exemplos: `ATP Salário`, `13º ATP`, `Férias ATP`, `Rolagem`, `Outros`;
- linha `Total` soma as entradas por mes.

Bloco inferior, linhas 18 a 45:

- saidas/despesas por descricao e forma de pagamento;
- mistura linhas calculadas por outras abas com linhas digitadas manualmente;
- linha `Total` soma as saidas por mes.

Linha 46:

- saldo acumulado;
- formula segue o padrao: saldo anterior + entradas do mes - saidas do mes;
- exemplo observado: `F46 = E46 + F13 - F45`.

Linhas 47 a 49:

- controles auxiliares/caixinhas e ajustes.

### Meses e projecao

A planilha mostra colunas por mes. No bloco atual analisado:

- `F:Q` representam meses futuros de `Jun/2026` a `Mai/2027`;
- linha 17 guarda indices numericos de meses futuros: `1, 2, 3...`;
- esses indices sao usados para decidir em qual mes uma parcela ainda aparece.

O sistema precisa oferecer pelo menos uma visao anual detalhada, nao apenas cards de resumo.

### Tipos de linha na projecao

Na aba principal existem linhas com naturezas diferentes:

- valores digitados direto para simular ou planejar;
- formulas que puxam compras parceladas;
- formulas que puxam custo fixo por descricao;
- formulas que puxam custo fixo por forma/origem;
- linhas de diferenca/limite;
- linhas de totais;
- saldo acumulado.

Isso significa que o app precisa separar `fonte do valor` de `valor projetado`.

## Parcelas

A aba `Parcelas` controla compras parceladas em cartao/origem.

### Campos observados

Cabecalho principal na linha 13:

- `Nº`;
- `Item`;
- `Origem`;
- `Prazo`;
- `Data Compra`;
- `Valor`;
- `Parcelas`;
- `Pago`;
- `Faltam`;
- `Valor Total`;
- `Valor Pago`;
- `Diferença`;
- `% Progresso`.

### Regras observadas

`Faltam`:

```text
Parcelas - Pago
```

`Valor Total`:

```text
Valor * Parcelas
```

`Valor Pago`:

```text
Valor * Pago
```

`Diferença`:

```text
Valor Total - Valor Pago
```

`Prazo`:

- `Curto` quando faltam ate 3 parcelas;
- `Médio` quando faltam ate 6 parcelas;
- `Longo` acima disso;
- pode virar `---` quando a linha estiver marcada como nao considerada.

### Como alimenta a aba principal

A aba principal usa `SUMIFS` em `Parcelas`.

Para linhas como `Itaú Click` e `Grazziotin`:

```text
somar Parcelas[Valor]
onde Parcelas[Origem] = descrição da linha principal
e Parcelas[Faltam] atende ao indice do mes futuro
```

Para `Parcelas (Nubank)`:

```text
somar Parcelas[Valor]
onde Parcelas[Origem] = forma/origem Nubank
e Parcelas[Faltam] atende ao indice do mes futuro
```

Essa diferenca e importante:

- algumas linhas comparam origem com a descricao da linha;
- outras comparam origem com a forma de pagamento.

No sistema, a regra precisa ser explicita por linha/origem.

## Custo Fixo

A aba `Custo Fixo` nao e um total geral de despesas. Ela e um cadastro de custos fixos, alguns dos quais entram na projecao principal.

### Campos observados

Cabecalho na linha 6:

- `Nº`;
- `Custo`;
- `Forma de Pagamento`;
- `Grupo`;
- `Vencimento`;
- `Valor`.

Exemplos:

- `Claro/NET` em `Itaú Kah`;
- `Google GSUITE` em `Nubank`;
- `Spotify` em `Nubank`;
- `Netflix` em `Nubank`;
- `Terapia Kah` em `PIX`;
- `Jeep Compass` em `PIX`;
- `Luz - RGE` em `PIX`;
- `Água - Semae` em `PIX`;
- `Sicredi (Empréstimo)` em `Sicredi`.

### Como alimenta a aba principal

A aba principal usa `SUMIF` contra `Custo Fixo`.

Por descricao/custo:

```text
somar Custo Fixo[Valor]
onde Custo Fixo[Custo] = descrição da linha principal
```

Exemplos:

- `Água - Semae`;
- `Claro/NET`;
- `Luz - RGE`;
- `Luz - RGE - Kah`.

Por forma/origem:

```text
somar Custo Fixo[Valor]
onde Custo Fixo[Forma de Pagamento] = origem da linha principal
```

Exemplo:

- `Custo Fixo (Nubank)` soma custos fixos cuja forma de pagamento e `Nubank`.

Observacao importante: custos fixos PIX existem no cadastro, mas nem todos necessariamente devem virar automaticamente uma linha da aba principal. A regra de entrada na projecao precisa ser controlada.

## Compras Gerais Planejadas

Na aba principal ha linhas digitadas manualmente para simular gastos futuros.

Exemplo forte:

- `Compras Gerais (Nubank)`;
- entra dentro do bloco Nubank;
- serve para planejar gastos que ainda nao sao parcelas nem custo fixo.

Essa funcionalidade e essencial. O usuario usa isso para responder:

- "se eu gastar isso no mes, fecha?";
- "posso comprar isso agora?";
- "em qual mes a situacao melhora?";
- "quanto sobra se entrar 13º ou ferias?".

No sistema, isso deve virar uma edicao rapida direto na projecao do mes, sem burocracia.

## Carro

Nome escolhido para substituir `Jeep Compass`: `Carro`.

Modulo proprio para cadastro do carro, cadastro do financiamento e gestao das parcelas.

### Campos observados

Resumo:

- valor financiado;
- valor de compra;
- financiamento total projetado;
- faltam parcelas;
- valor pago;
- falta pagar;
- economia.

Tabela principal:

- `Parcela`;
- `Ano`;
- `Mês`;
- `Valor`;
- `Pago`;
- `Economia`;
- `Status`.

### Regras observadas

- status pode ser `Pago` ou `Pendente`;
- quando `Pago` tem valor preenchido, calcula economia como `Valor - Pago`;
- quando pendente, valor segue projetado;
- a aba principal hoje possui linha `Jeep Compass` com valores mensais, mas a ligacao parece parcialmente manual na planilha visivel.

No sistema, o financiamento deve ser modulo proprio e suas parcelas futuras devem alimentar a projecao principal.

Roadmap futuro:

- botao de concluir financiamento;
- ao concluir, arquivar o financiamento atual;
- zerar/preparar a area para um proximo financiamento;
- manter historico do carro/financiamento anterior.

## Ant.FGTS

Modulo proprio para antecipacoes de FGTS.

### Estrutura observada

Dois blocos de contratos:

- bloco superior com contratos antigos/pagos parcialmente;
- bloco inferior com contratos ativos/futuros.

Campos:

- descricao;
- data;
- contrato;
- quitar;
- parcelas;
- valor recebido;
- valor pago;
- valor economizado ou valor a ser pago;
- colunas futuras por ano, como `Jul/2026`, `Jul/2027`, etc.

Tambem ha resumo de saldo:

- saldo;
- bloqueado;
- liberado.

No sistema, isso deve ser modulo separado para acompanhar contratos, valores futuros, saldo bloqueado/liberado e objetivo de quitacao.

## Pagamento / baixa

Hoje, quando o usuario paga algo, ele "deleta" ou remove o valor da projeção no Excel.

No sistema, isso nao pode virar um fluxo complexo.

Regra correta:

- o usuario deve poder marcar uma ocorrencia especifica como paga;
- essa ocorrencia sai da projecao pendente;
- o cadastro original permanece;
- deve existir historico minimo e opcao de desfazer;
- pagamento nao pode ser por item geral agregado.

Exemplos:

- pagar uma parcela Nubank de junho tira aquela ocorrencia do mes, nao apaga a compra inteira;
- pagar a parcela do Jeep em junho atualiza o contrato e a projecao;
- pagar um custo fixo especifico baixa aquela ocorrencia mensal.

## Implicacoes para o sistema

O sistema precisa ter estes conceitos antes de qualquer tela bonita:

- `Origem` ou `Conta`: Nubank, Santander, Itaú Click, Itaú Kah, PIX, Boleto, Sicredi etc.
- `Linha de Projecao`: uma linha que aparece na tela principal, com regra propria.
- `Ocorrencia Mensal`: valor que aparece em um mes especifico.
- `Parcela`: compra parcelada que gera ocorrencias futuras.
- `Custo Fixo`: custo recorrente que pode ou nao alimentar uma linha da projecao.
- `Compra Planejada`: valor manual/simulacao em um mes e origem.
- `Contrato`: financiamento/emprestimo com parcelas e status.
- `Pagamento`: baixa de uma ocorrencia sem destruir o cadastro original.

## O que o proximo MVP deve fazer

Primeiro MVP correto deve reproduzir o fluxo da planilha, mesmo que simples:

1. Tela principal `Controle Mensal`, com 12 meses em grade detalhada.
2. Bloco de entradas no topo.
3. Bloco de saidas abaixo, com linhas por descricao/origem.
4. Linha de total de entradas.
5. Linha de total de saidas.
6. Linha de saldo acumulado.
7. Cadastro de parcelas separado, com origem/cartao.
8. Parcelas alimentando automaticamente a linha/origem correspondente na projecao.
9. Cadastro de custos fixos separado.
10. Custos fixos alimentando a projecao por regra explicita.
11. Compras planejadas editaveis direto por mes na projecao.
12. Baixa simples por ocorrencia.

## O que nao repetir

- Nao criar um dashboard generico como tela principal.
- Nao criar um item "Custos fixos" agregado.
- Nao esconder origem/cartao dos valores.
- Nao tratar parcela, custo fixo, financiamento e FGTS como o mesmo tipo generico de item.
- Nao reduzir a projecao a cards mensais.
- Nao implementar nada novo antes de validar a modelagem contra a planilha.
