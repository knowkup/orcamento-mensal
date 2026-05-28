# CLAUDE.md — Orçamento Mensal

Instruções permanentes para este projeto. Seguir sempre, sem exceção.

---

## 1. Fluxo obrigatório — sem exceções

**Nunca tocar em arquivo sem aprovação explícita.**

Para qualquer tarefa:
1. **Analisar** o código relevante
2. **Listar** exatamente o que será feito (arquivos, o que muda em cada um)
3. **Aguardar** aprovação ("sim", "pode", "faz")
4. **Executar** as alterações
5. **Commitar** com mensagem clara
6. **Push** para `origin main` (GitHub Pages publica automaticamente em ~1 min)

Nunca pular o passo 3. Nunca fazer mais do que foi aprovado no passo 2.

---

## 2. Pensar antes de codar

**Não assumir. Não esconder dúvidas. Explicitar trade-offs.**

Antes de propor qualquer implementação:
- Se houver mais de uma forma de resolver, apresentar as opções — não escolher silenciosamente
- Se algo estiver ambíguo, parar e perguntar
- Se existir uma abordagem mais simples, dizer

---

## 3. Simplicidade primeiro

**Mínimo de código que resolve o problema. Nada especulativo.**

- Sem funcionalidades além do que foi pedido
- Sem abstrações para código de uso único
- Sem "flexibilidade" ou "configurabilidade" não solicitadas
- Sem tratamento de erro para cenários impossíveis

---

## 4. Mudanças cirúrgicas

**Tocar apenas no que é necessário. Não melhorar o que não foi pedido.**

- Não "melhorar" código adjacente, comentários ou formatação
- Não refatorar o que não está quebrado
- Se notar código morto não relacionado, mencionar — não deletar
- Cada linha alterada deve ter rastreabilidade direta ao pedido do usuário

---

## 5. Contexto do projeto

- **App:** Web app de orçamento pessoal (Felipe Kupka)
- **Stack:** HTML + CSS + JS puro, Firebase Firestore, Firebase Auth
- **Repositório:** `kupka1988/orcamento-mensal`
- **Deploy:** GitHub Pages — push em `main` publica automaticamente
- **Arquivos locais:** OneDrive (pasta de trabalho, sempre atualizada)
- **Nunca** deixar alterações apenas locais — sempre commitar e fazer push ao final

---

## 6. Identidade visual e padrões do projeto

- Ícones: Lucide Icons (`<i data-lucide="nome">` + `refreshIcons()`)
- SVGs dinâmicos devem ser embutidos inline (não depender do Lucide para elementos hidden)
- Modais: `<dialog class="dialog">`, abertos com `.showModal()`
- Tabelas: `.data-table` com classes `.col-center` e `.col-right` para alinhamento
- Titular/Dono: sempre usar `<span class="owner-pill">`
- Commit e push sempre ao final de cada conjunto de alterações aprovadas
