# Telas de Planos de Investimento

Telas em `/planos`. Um plano tem nome, descrição opcional, dono e até 50
simulações do dono: as que ele investiria juntas. As regras estão em "Planos
de Investimento" no [PRD](../investment-simulator-prd.md).

- A lista mostra os planos do dono por nome, 20 por página, cada um com
  descrição, quantidade de simulações e marcadores de situação. Ela se
  atualiza sozinha enquanto alguma simulação de um plano está sendo calculada.
  O estado vazio explica que um plano reúne o que é investido junto e que
  alternativas pertencem à comparação.
- Os marcadores nomeiam cada situação com sua contagem, em texto e cor: "Em
  atualização N", "Com pendência N", "Resultados desatualizados N". Um plano
  com todos os resultados atualizados não mostra nenhum. Enquanto a mudança de
  uma premissa é recalculada, suas simulações contam como desatualizadas, não
  em atualização.
- Os detalhes mostram nome, descrição, marcadores, "Editar" e "Excluir". A
  confirmação de exclusão informa que ela é definitiva e que "As N simulações
  continuam em Simulações".
- "Resumo" fica entre os marcadores e as simulações, escondido enquanto o
  plano não tem simulações, e se atualiza junto com o plano.
  - Mostra "Totais provisórios" enquanto alguma simulação está sendo
    calculada, tem pendência ou resultado desatualizado.
  - Sem nenhum resultado, diz "Nenhuma simulação tem resultado ainda.". Senão,
    diz "Valores no vencimento de cada simulação, sem reinvestimento." e,
    quando algumas não têm resultado, "N simulações sem resultado ficam fora
    dos totais.".
  - Depois vêm os valores (Aplicado, IOF, IR, Montante líquido, Rendimento
    líquido e o Período da primeira aplicação ao último vencimento), a tabela
    "Vencimentos" e o quadro "Liquidez", lado a lado a partir de 1024px e
    empilhados abaixo disso.
  - "Vencimentos" tem uma linha por mês com vencimento ("janeiro de 2027"),
    com a quantidade de simulações (sob o mês abaixo de 640px), o montante
    líquido e o total acumulado. Um mês com todos os vencimentos já passados
    (até hoje) leva "Vencido"; um com só parte deles, "N de M vencidas". Mostra
    6 linhas e depois "Mostrar todos (N)", que vira "Mostrar menos".
  - "Liquidez" divide o valor aplicado em "Diária" e "No vencimento", em R$ e
    %, sobre uma barra de dois segmentos que repete o texto. As regras estão
    em "Totais do Plano" no PRD.
- "Simulações do plano" lista todas as simulações do plano na mesma tabela da
  lista de simulações, com "Ordenar por" (a partir de duas simulações) e
  "Remover do plano" em cada linha: um ✕ discreto na última coluna (no fim da
  linha abaixo de 1280px), que só assume a cor de erro sob o cursor, pois a
  simulação é desvinculada, não excluída. Uma remoção por vez; uma falha nomeia
  a simulação. Selecionar de 2 a 6 simulações mostra a barra de comparação, que
  abre a comparação; essa seleção não fica no endereço da página. A página se
  atualiza sozinha enquanto alguma simulação está sendo calculada.
- "Adicionar simulações" abre um diálogo com as simulações do dono, 20 por
  página, e a mesma barra de filtros da lista de simulações (busca, filtros e
  "Ordenar por"; ver [Telas de Simulações](./simulations.md)), que na largura
  do diálogo se recolhe em "Filtros (N)".
  - Mudar um filtro ou a ordem volta à primeira página e mantém a escolha,
    inclusive de simulações que os filtros passaram a esconder.
  - Uma busca sem resultados diz "Nenhuma simulação corresponde aos filtros."
    com "Limpar filtros", diferente de não haver simulações.
  - Simulações que já estão no plano aparecem marcadas e desabilitadas ("já no
    plano"), e a escolha para nas vagas livres do plano.
  - Um único envio adiciona todas; uma falha mantém a escolha e mostra a
    mensagem do sistema. O diálogo fica aberto enquanto o envio está pendente.
- "Nova simulação" abre uma nova simulação a partir do plano. Depois de criada,
  um aviso oferece adicioná-la ao plano (ver "Planos" nas
  [Telas de Simulações](./simulations.md)); criá-la nunca a adiciona sozinha.
- Um plano cheio desabilita "Adicionar simulações" e "Nova simulação" e explica
  o motivo: "O plano está cheio: 50 simulações, o máximo. Remova uma para
  incluir outra."
- O editor tem o nome (obrigatório, até 100 caracteres) e a descrição
  (opcional, até 500). Se o plano foi alterado em outro lugar enquanto o
  usuário editava, inclusive por adicionar ou remover simulações, salvar avisa
  e mantém o que ele digitou até que recarregue. Alterações não salvas são
  confirmadas antes de sair.
- Um plano inexistente ou excluído tem seu próprio estado, que informa que as
  simulações continuam em Simulações.
