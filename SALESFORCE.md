# Integração Salesforce via CLI

## Acesso

Conexão existente via Salesforce CLI validada em produção. Não requer instalar outro plugin. A CLI não estava no PATH da sessão; o atualizador também reconhece a instalação padrão em `%LOCALAPPDATA%/Programs/SalesforceCLI/bin/sf.cmd`. Não copiamos tokens nem renovadores de autenticação para o projeto.

## Recorte dos times

Os cinco supervisores registrados em `salesforce-config.json` são consultados individualmente por `HunterSupervisor__c`. Um segundo agregado, identificado como `DISCONNECTED`, reúne todo registro cujo supervisor não esteja nessa lista, inclusive valores vazios. A interface chama esse grupo de **Desligados**. O total é a soma dos cinco supervisores e de Desligados.

Exibimos os nomes definidos pela configuração, sem juntar usuários diferentes pelo nome. Há duas contas chamadas Rodrigo Silva no CRM; a configuração usa o ID da conta ativa. Supervisor significa o valor atual do campo, sem reconstruir trocas históricas.

## Regras confirmadas

| Indicador | Objeto e filtro | Data do recorte |
|---|---|---|
| Agendamentos | Lead, incluindo convertidos, uma contagem por lead | `ScheduleDate__c` |
| Conexões | Opportunity, `DidTheMeetingTakePlace__c = 'Conectada'`, uma contagem por oportunidade | `MeetingDate__c` |
| Vendas | Opportunity com `IsWon = true` | `CloseDate` |
| Receita | Soma de `Amount` das oportunidades ganhas; não filtrar pelo pagamento | `CloseDate` |
| TM | Receita dividida pela quantidade de oportunidades ganhas do mesmo recorte | `CloseDate` |
| Pipeline | Opportunity com `IsClosed = false` e `Closer__c` preenchido, somar `Amount` | `CloseDate` previsto |

As datas dos indicadores realizados não ultrapassam o dia da extração em America/Sao_Paulo. Datas futuras de fechamento não são tratadas como vendas realizadas. O mês em andamento é parcial. Pipeline inclui datas futuras. O campo `Data_de_Pagamento__c` não é usado para Receita nem para Vendas.

A exclusão das atualmente perdidas foi confirmada pelo usuário. Logo, os meses passados podem mudar quando uma venda passa a perdida ou muda de supervisor. Não é um histórico imutável do estado que existia naquela época.

O Pipeline segue o estado aberto na extração apenas quando um Closer está atribuído. Uma venda registrada ainda aberta/aguardando pagamento pode aparecer também no Pipeline. Não é uma soma de indicadores mutuamente exclusivos.

## Grão diário e MTD

As consultas agrupam por data e supervisor, por ano. Com cinco supervisores, há no máximo 1.830 grupos por consulta anual, abaixo do limite de 2.000 grupos da consulta agregada. O processo exige `done = true`, ausência de paginação pendente e quantidade de linhas igual a `totalSize`; se houver erro, preserva o arquivo anterior.

O arquivo contém `dailyRows` (data/supervisor) e `rows` (mês/supervisor, derivado dos dias). `coverage` registra cada métrica/mês consultado. `partialPeriod` preserva que o mês da extração estava incompleto, inclusive se o arquivo for aberto depois.

MTD usa a posição do dia útil, não o número do dia no calendário. Por exemplo, o 11º dia útil de setembro é comparado ao 11º dia útil de cada mês anterior. Fins de semana e feriados nacionais não entram na contagem; a lista calcula Páscoa/Sexta-feira Santa, feriados fixos e Consciência Negra a partir de 2024. Datas específicas da empresa podem ser acrescidas em `businessCalendar.holidays` no snapshot. O valor realizado soma todos os eventos até a data de corte correspondente, sem estimativa proporcional.

TM é recalculado a partir da receita e quantidade no MTD; não é média dos tickets. Meses curtos são naturalmente limitados ao último dia útil. Comparações com base zero ou sem dados não inventam porcentagens.

No Pipeline, MTD filtra o dia previsto de fechamento; não reconstitui o saldo aberto no passado.

## Qualidade

- `null` significa desconhecido, não zero.
- Zero exige uma consulta completa sem eventos para aquele recorte.
- `COUNT(Amount)` é comparado a `COUNT(Id)`: se houver oportunidades sem valor, a soma monetária do grupo fica indisponível; as contagens continuam válidas. Não transformamos campos vazios em receita zero nem em ticket artificialmente menor.
- Reuniões conectadas sem data não entram em um mês arbitrário; sua quantidade é informada nos alertas.
- O dashboard exibe R$ conforme o campo monetário solicitado. A organização consultada não expõe `CurrencyIsoCode` em Opportunity.
- Dados exibidos são os registros acessíveis à conta autenticada. As consultas são somente leitura.

## Atualização e validação

Execute `sync-salesforce.ps1` e recarregue a página. O script usa a CLI existente, obtém somente agregados (sem dados de clientes), valida a carga e substitui o arquivo de dados após sucesso. Não há credenciais no navegador, servidor web público nem sincronização automática agendada.

Os testes cobrem exclusividade dos cinco supervisores, totais, ticket ponderado, ausência versus zero, datas futuras, extrações incompletas, MTD inclusive em meses curtos, filtros e renderização. Totais da primeira carga corrigida foram também reconciliados por uma consulta independente agrupada por fase no Salesforce.
