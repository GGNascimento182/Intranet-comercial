param(
  [string]$TargetOrg = 'gabriel.nascimento@idealsales.com.br',
  [ValidateRange(0,2100)][int]$StartYear = 0,
  [ValidateRange(2000,2100)][int]$EndYear = ((Get-Date).Year + 1),
  [ValidateSet('Amount','Valor_Total_Calculado__c')][string]$AmountField = 'Amount',
  [string]$SalesforceCli
)
$ErrorActionPreference = 'Stop'
$env:SF_DISABLE_TELEMETRY = 'true'
$env:SF_AUTOUPDATE_DISABLE = 'true'
$config = Get-Content (Join-Path $PSScriptRoot 'salesforce-config.json') -Raw | ConvertFrom-Json
foreach ($supervisor in $config.supervisors) { if ($supervisor.id -notmatch '^[a-zA-Z0-9]{18}$') { throw 'ID de supervisor inválido.' } }
if (@($config.supervisors).Count -ne 5) { throw 'A consulta deve incluir exatamente os cinco supervisores configurados.' }
$supervisorIds = ($config.supervisors | ForEach-Object { "'$($_.id)'" }) -join ','
$supervisorPredicate = "HunterSupervisor__c IN ($supervisorIds)"
$disconnectedPredicate = "(HunterSupervisor__c = null OR HunterSupervisor__c NOT IN ($supervisorIds))"
$salePredicate = if ($config.excludeLostSales) { ' AND (IsClosed = false OR IsWon = true)' } else { '' }
if ($StartYear -gt $EndYear) { throw 'Ano inicial posterior ao ano final.' }
if (-not $SalesforceCli) {
  $command = Get-Command sf -ErrorAction SilentlyContinue
  if ($command) { $SalesforceCli = $command.Source }
  else { $SalesforceCli = Join-Path $env:LOCALAPPDATA 'Programs/SalesforceCLI/bin/sf.cmd' }
}
if (-not (Test-Path -LiteralPath $SalesforceCli)) { throw 'CLI Salesforce não encontrada. Informe -SalesforceCli.' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodeExecutable = $nodeCommand.Source }
else { $nodeExecutable = [IO.Path]::GetFullPath((Join-Path (Split-Path $SalesforceCli) '../client/bin/node.exe')) }
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Node.js não encontrado.' }
function Invoke-SalesforceQuery([string]$Query) {
  $raw = & $SalesforceCli data query --target-org $TargetOrg --query $Query --json
  if ($LASTEXITCODE -ne 0) { throw "A consulta Salesforce falhou. A carga anterior foi preservada. $raw" }
  $response = ($raw -join "`n") | ConvertFrom-Json
  if ($response.status -ne 0 -or $response.result.done -ne $true -or $response.result.nextRecordsUrl -or @($response.result.records).Count -ne $response.result.totalSize) {
    throw 'Consulta incompleta. A carga anterior foi preservada.'
  }
  return @($response.result.records)
}
$started = [DateTime]::UtcNow.ToString('o')
$today = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'E. South America Standard Time').ToString('yyyy-MM-dd')
$thisYear = [int]$today.Substring(0,4)
$batches = [Collections.Generic.List[object]]::new()
$plans = @(
    @{key='appointments';object='Lead';date='ScheduleDate__c';predicate="ScheduleDate__c <= $today";aggregate='COUNT(Id) n'},
    @{key='connections';object='Opportunity';date='MeetingDate__c';predicate="DidTheMeetingTakePlace__c = 'Conectada' AND MeetingDate__c <= $today AND MeetingDate__c != 1899-12-30";aggregate='COUNT(Id) n'},
    @{key='sales';object='Opportunity';date='Dia_da_venda__c';predicate="Dia_da_venda__c <= $today$salePredicate";aggregate="COUNT(Id) n, COUNT($AmountField) valued, SUM($AmountField) amount"},
    @{key='pipeline';object='Opportunity';date='CloseDate';predicate='IsClosed = false';aggregate="COUNT(Id) n, COUNT($AmountField) valued, SUM($AmountField) amount"}
  )
$availableYears = @{}
$firstDates = @{}
foreach ($plan in $plans) {
  Write-Host "Localizando histórico de $($plan.key)..."
  $discovery = @(Invoke-SalesforceQuery "SELECT CALENDAR_YEAR($($plan.date)) y, COUNT(Id) n, MIN($($plan.date)) firstDate FROM $($plan.object) WHERE $($plan.date) != null AND $($plan.date) < $($EndYear+1)-01-01 AND $($plan.predicate) GROUP BY CALENDAR_YEAR($($plan.date))")
  $availableYears[$plan.key] = @($discovery | ForEach-Object { [int]$_.y })
  $firstDates[$plan.key] = ($discovery.firstDate | Sort-Object | Select-Object -First 1)
}
if ($StartYear -eq 0) {
  $realizedYears = @('appointments','connections','sales') | ForEach-Object { ($availableYears[$_] | Measure-Object -Minimum).Minimum }
  # O histórico do BP começa quando todos os indicadores realizados já têm dados.
  $StartYear = ($realizedYears | Measure-Object -Maximum).Maximum
  if (-not $StartYear) { $StartYear = $thisYear }
}
foreach ($year in $StartYear..$EndYear) {
  $start = "$year-01-01"; $end = "$($year+1)-01-01"
  foreach ($plan in $plans) {
    if ($year -gt $thisYear -and $plan.key -ne 'pipeline') { continue }
    # Five supervisors x at most 366 days = 1830 groups, below Salesforce's aggregate group limit.
    $group = "$($plan.date), HunterSupervisor__c, HunterSupervisor__r.Name"
    $query = "SELECT $($plan.date), HunterSupervisor__c, HunterSupervisor__r.Name, $($plan.aggregate) FROM $($plan.object) WHERE $($plan.date) >= $start AND $($plan.date) < $end AND $($plan.predicate) AND $supervisorPredicate GROUP BY $group"
    $disconnectedQuery = "SELECT $($plan.date), $($plan.aggregate) FROM $($plan.object) WHERE $($plan.date) >= $start AND $($plan.date) < $end AND $($plan.predicate) AND $disconnectedPredicate GROUP BY $($plan.date)"
    Write-Host "Consultando $($plan.key) / $year..."
    $selectedRecords = if ($availableYears[$plan.key] -contains $year) { @(Invoke-SalesforceQuery $query) } else { @() }
    $disconnectedRecords = if ($availableYears[$plan.key] -contains $year) { @(Invoke-SalesforceQuery $disconnectedQuery) } else { @() }
    foreach ($record in $disconnectedRecords) {
      $record | Add-Member -NotePropertyName HunterSupervisor__c -NotePropertyValue 'DISCONNECTED' -Force
      $record | Add-Member -NotePropertyName Name -NotePropertyValue 'Desligados' -Force
    }
    $records = @($selectedRecords) + @($disconnectedRecords)
    $batches.Add(@{year=$year;metric=$plan.key;dateField=$plan.date;records=$records})
  }
}
$quality = @(Invoke-SalesforceQuery "SELECT COUNT(Id) n FROM Opportunity WHERE DidTheMeetingTakePlace__c = 'Conectada' AND MeetingDate__c = null")
$invalidDates = @(Invoke-SalesforceQuery "SELECT COUNT(Id) n FROM Opportunity WHERE DidTheMeetingTakePlace__c = 'Conectada' AND MeetingDate__c = 1899-12-30")
$payload = @{
  startYear=$StartYear;endYear=$EndYear;today=$today;startedAt=$started;extractedAt=[DateTime]::UtcNow.ToString('o');
  amountField=$AmountField;batches=$batches.ToArray();connectedWithoutDate=[int]$quality[0].n;invalidMeetingDates=[int]$invalidDates[0].n;firstDates=$firstDates;supervisors=@($config.supervisors);excludeLostSales=[bool]$config.excludeLostSales
}
$payload | ConvertTo-Json -Depth 30 -Compress | & $nodeExecutable (Join-Path $PSScriptRoot 'build-salesforce-data.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Falha na validação ou gravação dos dados.' }
Write-Host 'Atualização concluída. Recarregue index.html no navegador.'
