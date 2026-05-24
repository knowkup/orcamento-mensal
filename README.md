# Orçamento Mensal

Aplicativo pessoal para controle mensal de orçamento, com foco em projeção dos próximos meses, pagamentos simples e sincronização por Firebase.

## Estrutura

- `index.html`: interface principal.
- `styles.css`: identidade visual e responsividade.
- `app.js`: lógica da projeção, pagamentos e integração Firebase.
- `firebase-config.js`: configuração pública do app Firebase.
- `firestore.rules`: regras de segurança do Firestore por usuário.

## Firebase

Preencha `firebase-config.js` com as chaves do projeto Firebase Web App.

Modelo de dados:

```txt
users/{uid}/items/{itemId}
```

Publique `firestore.rules` antes de usar dados reais.

## Validação local

```bash
node --check app.js
git diff --check
```
