# Checklist de Homologacao

Use este checklist depois de mudancas publicadas em producao.

Ultima atualizacao: 2026-06-06

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
- Duas alteracoes salvas rapidamente permanecem apos recarregar a pagina.
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
- Ordenar a Rota por ordem, prioridade, vencimento, saldo e nome funciona.
- Abrir e fechar detalhes de uma divida funciona pelo nome e pelo botao de expansao.
- Em Espera carrega.
- Fora do Radar carrega.
- Quitadas carrega.
- Renegociacao carrega.
- Limpar selecao de renegociacao funciona.
- Criar acordo abre o modal quando ha dividas selecionadas.
- Exportar backup JSON de Dividas funciona.
- Exportar CSV de dividas e pagamentos funciona.
- Importar JSON de Dividas permite selecionar o arquivo.
- Limpar todos os dados abre apenas o modal de confirmacao.
- Abrir uma divida funciona.
- Criar divida ativa, em espera e fora do radar abre o formulario com o status correto.
- Editar e salvar uma divida preserva parcelas e pagamentos existentes.
- Mover dividas entre Rota, Em Espera e Fora do Radar funciona.
- Registrar pagamento de divida funciona.
- Fechar o modal de pagamento sem salvar funciona.
- Editar uma parcela, salvar e fechar o modal funciona.
- Excluir pagamento funciona.
- Quitar divida funciona.
- Alterar o valor de quitacao atualiza o resumo imediatamente.
- Fechar o modal de quitacao sem confirmar funciona.
- Alterar ordem da rota funciona.
- Reordenar pela seta para cima/baixo funciona em Ordem da Rota.
- Arrastar uma divida para outra posicao atualiza e preserva a nova ordem.
- Ordenar e reordenar Em Espera por seletor, setas e arraste funciona.
- Ordenar e reordenar Fora do Radar por seletor, setas e arraste funciona.
- Criar, editar e excluir credor sem dividas funciona.
- Credor vinculado bloqueia exclusao e mostra aviso.
- Unificar credor com o cadastro do Orcamento preserva as dividas vinculadas.
- A parcela de divida integrada aparece no Controle Mensal quando aplicavel.
- Se houve mudanca em eventos/bindings de Dividas, todas as abas de Dividas devem continuar mostrando dados.
- Se houve mudanca em eventos/bindings de Dividas, testar filtros, ordenacao e abrir/fechar detalhes antes de seguir.

---

## Preferencias

- O topo de Preferencias mostra resumo de credores, cartoes/crediarios, rendas e limite Kah.
- O resumo muda apos criar/editar/excluir cadastros relacionados.
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
