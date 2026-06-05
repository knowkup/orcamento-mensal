# Checklist de Homologacao

Use este checklist depois de mudancas publicadas em producao.

Ultima atualizacao: 2026-06-05

---

## Antes de testar

- Abrir o app publicado.
- Confirmar que a tela carrega sem erro visual evidente.
- Confirmar que o painel de sincronizacao aparece na sidebar.
- Se a mudanca tocar dados, exportar um backup antes de testar.

---

## Sincronizacao e backup

- O status muda para conectado/sincronizado depois do carregamento.
- O painel de sincronizacao muda visualmente entre conectando, sincronizado, offline e erro.
- Passar o mouse no painel de sincronizacao mostra a mensagem completa do estado atual.
- Ao salvar algo, aparece feedback de salvamento/sincronizacao.
- Exportar backup gera um arquivo `.json` com data e horario no nome.
- Importar backup valido mostra mensagem de sucesso com nome do arquivo.
- Importar arquivo invalido mostra mensagem de erro.
- Depois de importar, o seletor de arquivo permite selecionar o mesmo arquivo novamente.

---

## Controle Mensal

- A tela de Controle Mensal abre corretamente.
- O topo mostra mes, status, pendencias, saldo em conta e saldo projetado.
- O resumo operacional mostra valores a receber, a pagar, realizado e fechamento.
- Recebimentos pendentes aparecem.
- Saidas pendentes aparecem.
- Cabecalhos de entradas, saidas e realizado mostram quantidades coerentes.
- Cada linha mostra status visual coerente: Pendente, Parcial, Pago ou Recebido.
- Realizado do mes aparece.
- Registrar recebimento funciona.
- Cancelar recebimento funciona.
- Registrar pagamento funciona.
- Cancelar pagamento funciona.
- Fechar mes continua bloqueado quando ha pendencias.
- Fechar mes funciona quando nao ha pendencias.

---

## Planejamento

- Grafico de saldo acumulado carrega.
- Resumo mensal carrega.
- Expandir detalhes de um mes funciona.
- Novo lancamento planejado abre o modal.
- Salvar lancamento planejado atualiza a projecao.
- Excluir lancamento manual continua funcionando.

---

## Parcelamentos e custos fixos

- Lista de parcelamentos carrega.
- Filtros de parcelamentos funcionam.
- Novo parcelamento abre modal.
- Salvar parcelamento atualiza a lista.
- Baixar/parar baixa de parcela funciona.
- Lista de custos fixos carrega.
- Editar valor de custo fixo no mes funciona.

---

## Dividas

- Dashboard de Dividas carrega.
- Rota Financeira carrega.
- Em Espera carrega.
- Fora do Radar carrega.
- Quitadas carrega.
- Renegociacao carrega.
- Abrir uma divida funciona.
- Registrar pagamento de divida funciona.
- Excluir pagamento funciona.
- Quitar divida funciona.
- Alterar ordem da rota funciona.
- A parcela de divida integrada aparece no Controle Mensal quando aplicavel.
- Se houve mudanca em eventos/bindings de Dividas, todas as abas de Dividas devem continuar mostrando dados.
- Se houve mudanca em eventos/bindings de Dividas, testar filtros, ordenacao e abrir/fechar detalhes antes de seguir.

---

## Preferencias

- Credores carregam.
- Cartoes/crediarios carregam.
- Rendas carregam.
- Criar/editar credor funciona.
- Criar/editar cartao funciona.
- Criar/editar renda funciona.
- Logos continuam aparecendo quando cadastradas.

---

## Mobile

- Bottom navigation aparece.
- Botao Mais abre e fecha.
- Troca de abas funciona.
- Modais cabem na tela.
- Toast aparece sem cobrir botoes importantes por tempo excessivo.

---

## Criterio de aceite rapido

Uma mudanca pode ser considerada homologada quando:

- O fluxo alterado funciona.
- Nenhum fluxo critico relacionado quebrou.
- Backup/exportacao continuam funcionando.
- Sincronizacao parece normal.
- Nao ha erro visual gritante em desktop ou mobile.
