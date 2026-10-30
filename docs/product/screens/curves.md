# Telas de Curvas

Telas em `/curvas`. Uma curva tem índice (que fixa a convenção dos valores),
nome, descrição opcional, intervalos com valores e dono. Alternativas de um
índice são curvas distintas; as telas as agrupam por índice e origem, mas
nenhum agrupamento é guardado. Visibilidade e propriedade seguem as
[Telas de Ofertas](./offers.md), e as regras estão na
[especificação das curvas](../index-value-curves.md).

- A lista mostra as curvas visíveis ao usuário agrupadas por índice e depois
  por origem ("Do sistema", "Minhas"), ordenadas pelo nome, cada uma com sua
  cobertura e o aviso de que o último valor vale em diante ("01/01/2024 a
  31/12/2028, mantida em diante"). Ela filtra por índice, sem paginação; o
  filtro fica no endereço da página e acompanha o usuário até uma curva e de
  volta. "Nova curva" a partir de uma lista filtrada já começa com o índice.
- Os detalhes mostram índice, convenção, cobertura, origem e descrição, um
  gráfico em degraus dos valores ao longo do tempo e a tabela de intervalos.
  - Cada degrau vai até o início do intervalo seguinte. Depois do último fim,
    o último valor aparece tracejado por um sexto do período anterior (no
    mínimo 31 dias), com a leitura "após dd/mm/aaaa (taxa mantida)".
  - Uma linha do zero aparece quando há valor negativo. O valor e as datas do
    intervalo sob o cursor, ou sob o foco do teclado, aparecem numa faixa acima
    do gráfico, nunca sobre o eixo.
  - "Simulações com esta curva" funciona como nas ofertas, com "Ver todas (N)"
    levando à lista de simulações filtrada pela curva.
  - Curvas próprias oferecem "Editar", "Duplicar" e "Excluir". Uma curva do
    sistema mostra "Curva do sistema: somente leitura" e oferece somente
    "Duplicar", como ação principal. "Duplicar" cria uma cópia privada chamada
    "<nome> (cópia)", com o mesmo índice e conteúdo.
- O editor altera nome, descrição e intervalos. O índice só é escolhido na
  criação, onde começa vazio (ou com o índice da lista filtrada), e as linhas
  aparecem depois da escolha. A criação também oferece "Copiar intervalos de":
  uma curva base do índice escolhido, cuja escolha define o índice e substitui
  as linhas. Trocar entre índice diário e mensal na criação limpa as linhas.
- Os intervalos são uma tabela editável, com uma linha por intervalo: início,
  fim e valor, todos inclusivos.
  - CDI e SELIC usam datas e uma taxa anual em percentual, nunca negativa. Os
    calendários oferecem só dias úteis dentro dos limites da linha: o do fim
    abre no mês do início e não oferece nada antes do início (um intervalo de
    um dia continua possível) nem a partir do fim da linha seguinte; o do
    início não oferece nada até o início da linha anterior nem depois do seu
    próprio fim. Datas digitadas não são bloqueadas, e mudar um início confere
    na hora um fim já preenchido.
  - IPCA usa meses (MM/AAAA, do primeiro ao último dia) e uma variação mensal
    em percentual maior que −100%, que pode ser negativa.
- As linhas permanecem contíguas durante a edição:
  - Mudar um fim leva o início da linha seguinte ao próximo dia útil (ou mês);
    mudar um início leva o fim da linha anterior ao dia útil (ou mês) anterior.
  - Remover uma linha entre outras duas faz a anterior ir até o início da
    seguinte. Remover a primeira ou a última encurta a curva, sem estender uma
    vizinha sobre os dias removidos.
  - "Dividir em dois" divide a linha no início de mês mais próximo do meio (ou
    no dia útil, ou mês, do meio quando ela cabe num só mês); as duas metades
    mantêm o valor, e o valor da segunda recebe o foco.
  - "Adicionar intervalo" começa a nova linha logo depois da última e sugere
    como fim o último dia útil daquele mês (ou o mesmo mês), com o foco no
    valor. O campo de valor sugere o valor da linha anterior.
  - Remover uma linha, trocar entre índice diário e mensal com linhas
    preenchidas ou copiar uma curva base sobre linhas digitadas oferece
    "Desfazer", logo abaixo das linhas, até a próxima edição ou o salvamento.
    Remover leva o foco a "Desfazer"; desfazer o leva à linha restaurada.
  - Os campos vazios de uma linha nova só são apontados no próximo salvamento.
- Sobreposições e dias úteis (ou meses) faltando são apontados na linha
  posterior, com a mensagem do sistema e a correção "Começar em <data>" em um
  clique. Como as linhas se seguem, digitar sozinho não abre uma lacuna: a
  mensagem serve para curvas carregadas com uma ou para uma lacuna apontada ao
  salvar. Uma data de fim de semana ou feriado mostra "Não é dia útil." sem
  bloquear. Pelo menos uma linha é obrigatória. Um resumo informa a cobertura
  (em meses no IPCA) e que o último valor vale em diante. No celular, cada
  linha tem o título "Intervalo N" e suas ações mostram o nome. Valores
  observados e projetados ainda não se distinguem (pendência na especificação
  das curvas).
- O editor segue as regras de aviso e de salvamento do editor de ofertas. O
  aviso aparece só enquanto a edição muda os intervalos: "As N simulações que
  usam esta curva serão recalculadas." ("A simulação que usa esta curva será
  recalculada." para uma). Editar só nome ou descrição não mostra o aviso.
- Excluir uma curva informa quantas simulações do usuário precisarão de uma
  nova escolha ("Sem curva, escolha outra"). Suas cópias não são afetadas.
