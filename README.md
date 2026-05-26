# Orçamento Mensal

Aplicativo pessoal para controle mensal de orçamento, guiado pela lógica da planilha original.

A tela principal é o **Controle Mensal**: uma projeção detalhada dos próximos meses, com entradas, saídas, compras planejadas, parcelas, custos fixos, carro, FGTS, credores e saldo acumulado.

## Estrutura

- `index.html`: interface principal.
- `styles.css`: identidade visual e responsividade.
- `js/`: lógica do app dividida em módulos ES por responsabilidade.
- `firebase-config.js`: configuração pública do app Firebase.
- `firestore.rules`: regras de segurança do Firestore por usuário.

## Firebase

Preencha `firebase-config.js` com as chaves do projeto Firebase Web App.

Modelo de dados principal:

```txt
users/{uid}/app/state
```

Publique `firestore.rules` antes de usar dados reais.

## Roadmap

- Refinar mobile.
- Importar dados reais da planilha.
- Melhorar a gestão completa do financiamento do carro.
- Adicionar fluxo futuro de concluir financiamento e preparar um novo.
- FGTS: painel resumo com total recebido, total devido, total pago e total a pagar.
- FGTS: melhorar layout, editar/excluir empréstimos e manter resumo fechado com recebido, a pagar, parcelas e próximo vencimento.

## Validação local

```bash
node --check js/app.js
git diff --check
```
