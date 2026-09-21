// Metas mensais cadastradas. Inclua novos meses sem alterar a lógica do painel.
window.BUSINESS_PLAN = {
  workCalendar: { label: 'dias úteis, excluindo feriados nacionais' },
  months: {
    '2026-09': {
      calls: 53825, schedulingRate: 0.04, appointments: 2153,
      connectionRate: 0.50, meetings: 1077, conversionRate: 0.20,
      sales: 215, revenue: 430750, ticket: 2001
    }
  },
  weeklyCloserPlan: {
    '2026-09': {
      teams: [
        {key:'im',label:'IM — Ideal Marketing',project:'IdealMarketing',targets:[21904,21904,27380,27380,16468]},
        {key:'im2',label:'IM 2 — Ideal Marketing 2',members:['Alessandro Melo','João Neto','Thiago Silva','Mateus Gayoso'],targets:[11038,11308,23338,23338,11250]},
        {key:'bc',label:'BC — Busca Cliente',project:'BuscaCliente',targets:[21120,26400,26400,26400,10560]}
      ]
    }
  }
};
