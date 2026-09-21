# Dashboard Comercial

Abra `index.html` no navegador. HTML, CSS e JavaScript sem instalação de bibliotecas.

## Publicação no GitHub Pages

O workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) publica esta pasta quando mudanças chegam à branch `main` e atualiza o snapshot do Salesforce a cada hora (no minuto 17).

1. Crie ou associe este diretório a um repositório GitHub e envie a branch `main`.
2. No repositório, em **Settings → Pages**, selecione **GitHub Actions** como fonte.
3. Cadastre o segredo `SF_AUTH_URL` no repositório com uma URL de autenticação SFDX de uma conta Salesforce somente-leitura.
4. Cadastre `SUPABASE_SERVICE_ROLE_KEY` como segredo do repositório e, opcionalmente, `SUPABASE_URL`. O padrão já aponta para o projeto atual. A chave é usada apenas no GitHub Actions e nunca é incluída no site ou nos commits.
5. Atualize os agregados localmente com `./sync-salesforce.ps1` e `node ./sync-supabase-data.cjs`, revise os snapshots e faça o push quando necessário.

O navegador continua recebendo apenas snapshots agregados. A atualização ocorre no GitHub Actions e publica uma nova versão quando os dados mudam.

## Dados reais e recorte

A carga utiliza a Salesforce CLI autenticada, sem plugin adicional e sem credenciais no HTML. Inclui somente as contas ativas de Guilherme Bispo, Rodrigo Silva, Samantha Jeronimo, Thais Leite e Willian Cardoso. O mesmo recorte vale para cartões, tabela, totais e histórico.

- **Receita:** soma de `Amount` somente das oportunidades ganhas (`IsWon = true`), por `CloseDate`. Não depende de pagamento.
- **Vendas:** quantidade das mesmas oportunidades ganhas usadas em Receita.
- **TM:** Receita / Vendas, com os mesmos critérios e período.
- **Agendamentos:** leads por `ScheduleDate__c`, incluindo convertidos.
- **Conexões:** oportunidades com `DidTheMeetingTakePlace__c = Conectada`, por `MeetingDate__c`.
- **Pipeline:** oportunidades abertas com Closer definido, por `CloseDate` previsto no mês. Não entra no histórico.
- **Ligações:** snapshot do Supabase. O cartão mostra CNPJs distintos (vínculo CRM) e, abaixo, o total de ligações.

## Filtro do histórico

O seletor de mês no cabeçalho controla os cartões, a tabela e o último mês do histórico. No histórico, escolha **MTD · mesmo dia útil** ou **Mês completo**. Em MTD, ajuste a posição do dia útil para comparar o acumulado até a mesma posição em todos os meses. Fins de semana e feriados nacionais não contam; meses mais curtos terminam no último dia útil. O padrão é a posição do dia útil da extração. O filtro MTD afeta apenas o histórico.

O MTD utiliza agregados diários reais, sem estimativas proporcionais. O Pipeline é mostrado somente na visão do mês atual; por isso não é comparado em períodos históricos.

## Atualizar dados

Execute no PowerShell, dentro desta pasta:

```powershell
.\sync-salesforce.ps1
```

O script localiza `sf` pelo PATH ou pela instalação em `%LOCALAPPDATA%/Programs/SalesforceCLI/bin/sf.cmd`. Você também pode informar `-SalesforceCli`, `-TargetOrg`, `-StartYear` e `-EndYear`. O padrão consulta desde 2025 até o fim do próximo ano. Após concluir, recarregue o navegador. No repositório publicado, o workflow também atualiza os snapshots a cada hora.

A autenticação fica sob controle da CLI. A atualização é somente leitura no Salesforce e grava apenas agregados por data/supervisor no projeto. A carga anterior é preservada em caso de erro ou resposta incompleta.

## Componentes e arquivos

- `components.js`: menu, ícones e componentes originais da referência.
- `crm-components.js`: cartões e tabelas dos times Hunter e Closer.
- `data-model.js`: validação, totais e recortes mensais/MTD por dia útil.
- `supabase-model.js`: agregação de CNPJs, ligações e métricas por pessoa/time.
- `sync-supabase-data.cjs`: consulta o Supabase no ambiente de atualização e gera `supabase-data.js` sem segredos.
- `performance.js`: página de desempenho por time, histórico por pessoa e histórico diário.
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
