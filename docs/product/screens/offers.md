# Telas de Ofertas

Telas em `/ofertas`. Uma oferta tem tipo de título (fixo depois da criação),
emissor opcional, remuneração e taxa, vencimento, liquidez, apelido opcional e
dono. Toda tela a apresenta pelos termos ("CDB 110% do CDI") e, abaixo, pelo
emissor ("Sem emissor") e pelo apelido, quando houver. As
ofertas do usuário são privadas e editáveis; as do sistema são visíveis para
todos e somente leitura. Cada oferta é independente: as telas as agrupam, mas
nenhum agrupamento é guardado. As regras estão no
[PRD](../investment-simulator-prd.md).

- A lista mostra as ofertas visíveis ao usuário agrupadas por tipo de título e
  origem ("Do sistema", "Minhas"), cada uma com termos, emissor, apelido,
  vencimento e liquidez, 20 por página, ordenadas por remuneração, taxa (maior
  primeiro) e vencimento. Ela filtra por busca no apelido ou emissor ("Buscar
  por apelido ou emissor"), tipo de título e origem. Buscar ou mudar um
  filtro volta à primeira página. Filtros e página ficam no
  endereço da página e acompanham o usuário até uma oferta e de volta à lista.
- Os detalhes mostram os termos exatos da oferta. Ofertas próprias oferecem
  "Editar", "Duplicar" e "Excluir"; ofertas do sistema oferecem somente
  "Duplicar", que cria uma cópia privada. Uma oferta inexistente ou excluída
  tem seu próprio estado.
- "Simulações com esta oferta" lista as 20 primeiras simulações do usuário que
  a usam, cada uma levando à simulação, e depois "Ver todas (N)", que abre a
  lista de simulações filtrada pela oferta. O bloco tem seus próprios estados
  de carregamento, vazio e falha com nova tentativa.
- Excluir pede confirmação, informa que a exclusão é definitiva e que "N
  simulações ficarão sem oferta (Sem oferta, escolha outra)".
- No editor, o tipo de título aparece como informação fixa. Mudar o tipo de
  remuneração limpa a taxa, porque sua unidade mudou. Enquanto a edição muda
  os termos (vencimento ou remuneração; uma taxa ainda inválida conta como
  mudança), o editor informa antes de salvar: "As N simulações que usam esta
  oferta serão recalculadas." ("A simulação que usa esta oferta será
  recalculada." para uma). Editar só apelido, emissor ou liquidez, ou uma
  oferta que nenhuma simulação usa, não mostra o aviso. "Duplicar" mantém o
  apelido com "(cópia)"; uma oferta sem apelido gera uma cópia sem apelido.
- Termos próprios de uma simulação não aparecem em Ofertas; "Salvar como
  oferta", na simulação, os traz para Minhas.
- Uma oferta do sistema não tem editor. Se a oferta foi alterada em outro
  lugar enquanto o usuário editava, salvar avisa e mantém o que ele digitou
  até que recarregue.
