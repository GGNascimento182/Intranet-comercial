// Metas mensais cadastradas. Inclua novos meses sem alterar a lógica do painel.
window.BUSINESS_PLAN = {
  workCalendar: { label: 'dias úteis, excluindo feriados nacionais' },
  months: {
    '2026-09': {
      calls: 53825, schedulingRate: 0.04, appointments: 2153,
      connectionRate: 0.50, meetings: 1077, conversionRate: 0.20,
      sales: 215, revenue: 430750, ticket: 2001
    },
    '2026-10': {
      // Esteira a partir das taxas do plano de setembro: 4% de agendamento,
      // 50% de conexões e 20% de conversão. A receita é a meta global.
      calls: 40750, schedulingRate: 0.04, appointments: 1630,
      connectionRate: 0.50, meetings: 815, conversionRate: 0.20,
      sales: 163, revenue: 326250, ticket: 2001
    }
  },
  weeklyCloserPlan: {
    '2026-09': {
      teams: [
        {key:'im',label:'IM — Ideal Marketing',project:'IdealMarketing',targets:[21904,21904,27380,27380,16468]},
        {key:'im2',label:'IM 2 — Ideal Marketing 2',members:['Alessandro Melo','João Neto','Thiago Silva','Mateus Gayoso'],targets:[11038,11308,23338,23338,11250]},
        {key:'bc',label:'BC — Busca Cliente',project:'BuscaCliente',targets:[21120,26400,26400,26400,10560]}
      ]
    },
    '2026-10': {
      // Fonte: Equipe_com_metas_Closers.xlsx, aba METAS. Busca consolida
      // Busca 1 + Busca 2; IM 1 e IM 2 permanecem separados. Cada total é
      // repartido pelos 21 dias úteis: S1=2, S2=5, S3=4 (12/10 é feriado),
      // S4=5 e S5=5 dias.
      teams: [
        {key:'im',label:'IM — Ideal Marketing',project:'IdealMarketing',targets:[11488.10,28720.24,22976.19,28720.24,28720.23]},
        {key:'im2',label:'IM 2 — Ideal Marketing 2',members:['Alessandro Melo','João Neto','Thiago Silva','Mateus Gayoso'],targets:[3869.05,9672.62,7738.10,9672.62,9672.61]},
        {key:'bc',label:'BC — Busca Cliente',project:'BuscaCliente',targets:[15714.29,39285.71,31428.57,39285.71,39285.72]}
      ]
    }
  }
};
