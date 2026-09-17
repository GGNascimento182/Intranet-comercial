# Dashboard Comercial

Abra `index.html` no navegador. HTML, CSS e JavaScript sem instalação de bibliotecas.

## Publicação no GitHub Pages

O workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) publica esta pasta quando mudanças chegam à branch `main` e atualiza o snapshot do Salesforce a cada hora (no minuto 17).

1. Crie ou associe este diretório a um repositório GitHub e envie a branch `main`.
2. No repositório, em **Settings → Pages**, selecione **GitHub Actions** como fonte.
3. Cadastre o segredo `SF_AUTH_URL` no repositório com uma URL de autenticação SFDX de uma conta Salesforce somente-leitura. O workflow a usa apenas no GitHub Actions; ela nunca é incluída no site ou nos commits.
4. Atualize os agregados localmente com `./sync-salesforce.ps1`, revise `salesforce-data.js` e faça o push quando necessário.

O navegador continua recebendo apenas o snapshot agregado. A atualização ocorre no GitHub Actions e publica uma nova versão quando os dados mudam.

## Dados reais e recorte

A carga utiliza a Salesforce CLI autenticada, sem plugin adicional e sem credenciais no HTML. Inclui somente as contas ativas de Guilherme Bispo, Rodrigo Silva, Samantha Jeronimo, Thais Leite e Willian Cardoso. O mesmo recorte vale para cartões, tabela, totais e histórico.

- **Receita:** soma de `Amount` por `Dia_da_venda__c`, excluindo oportunidades atualmente perdidas e datas futuras. Não depende de pagamento.
- **Vendas:** quantidade das mesmas oportunidades usadas em Receita.
- **TM:** Receita / Vendas, com os mesmos critérios e período.
- **Agendamentos:** leads por `ScheduleDate__c`, incluindo convertidos.
- **Conexões:** oportunidades com `DidTheMeetingTakePlace__c = Conectada`, por `MeetingDate__c`.
- **Pipeline:** oportunidades abertas na extração por `CloseDate`. Valores faltantes tornam o total afetado indisponível.
- **Ligações:** indisponíveis, pois o discador ainda não foi conectado.

## Filtro do histórico

O seletor de mês no cabeçalho controla os cartões, a tabela e o último mês do histórico. No histórico, escolha **MTD · mesmo dia útil** ou **Mês completo**. Em MTD, ajuste a posição do dia útil para comparar o acumulado até a mesma posição em todos os meses. Fins de semana e feriados nacionais não contam; meses mais curtos terminam no último dia útil. O padrão é a posição do dia útil da extração. O filtro MTD afeta apenas o histórico.

O MTD utiliza agregados diários reais, sem estimativas proporcionais. No Pipeline, o corte é pelo dia previsto de fechamento das oportunidades abertas na extração; não representa o saldo aberto em datas passadas.

## Atualizar dados

Execute no PowerShell, dentro desta pasta:

```powershell
.\sync-salesforce.ps1
```

O script localiza `sf` pelo PATH ou pela instalação em `%LOCALAPPDATA%/Programs/SalesforceCLI/bin/sf.cmd`. Você também pode informar `-SalesforceCli`, `-TargetOrg`, `-StartYear` e `-EndYear`. O padrão consulta desde 2025 até o fim do próximo ano para o Pipeline. Após concluir, recarregue o navegador. Não há atualização automática agendada.

A autenticação fica sob controle da CLI. A atualização é somente leitura no Salesforce e grava apenas agregados por data/supervisor no projeto. A carga anterior é preservada em caso de erro ou resposta incompleta.

## Componentes e arquivos

- `components.js`: menu, ícones e componentes originais da referência.
- `crm-components.js`: `<crm-metric>`, `<crm-team>` e `<monthly-history>`, alimentados pela propriedade `.data`.
- `data-model.js`: validação, totais e recortes mensais/MTD por dia útil.
- `business-plan.js` e `business-plan-config.js`: página Business Plan e metas mensais cadastradas.
- `crm-app.js`: filtros e composição.
- `salesforce-config.json`: os cinco IDs/nome de supervisores e exclusão de perdidas.
- `sync-salesforce.ps1`: consultas à CLI autenticada.
- `build-salesforce-data.cjs`: valida e consolida os agregados diários e mensais.
- `salesforce-data.js`: dados gerados, data/hora de extração e alertas de qualidade. Não editar os valores manualmente.
- `SALESFORCE.md`: regras, campos e limitações.

Testes:

```powershell
node --test data-model.test.js build-salesforce-data.test.cjs dashboard-render.test.cjs
```
