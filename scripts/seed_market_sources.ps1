param(
  [string]$ApiUrl = "http://localhost:8000",
  [string]$IngestionKey = "development-ingestion-key"
)

$headers = @{ "X-Ingestion-Key" = $IngestionKey; "Content-Type" = "application/json" }
$sources = @(
  @{ name = "Pushpay public careers"; adapter = "greenhouse"; identifier = "pushpay"; company = "Pushpay"; permission_basis = "Public Greenhouse job board API" },
  @{ name = "Rocket Lab public careers"; adapter = "greenhouse"; identifier = "rocketlab"; company = "Rocket Lab"; permission_basis = "Public Greenhouse job board API" }
)

foreach ($source in $sources) {
  $body = $source | ConvertTo-Json
  try {
    $created = Invoke-RestMethod "$ApiUrl/api/v1/market/collectors" -Method Post -Headers $headers -Body $body
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
      $identifier = [string]$source["identifier"]
      $created = @(Invoke-RestMethod "$ApiUrl/api/v1/market/collectors" -Method Get -Headers $headers | Where-Object { [string]$_.identifier -eq $identifier } | Select-Object -First 1)[0]
    } else { throw }
  }
  $sourceId = [string](($created | Select-Object -First 1).id)
  $run = Invoke-RestMethod "$ApiUrl/api/v1/market/collectors/$sourceId/run" -Method Post -Headers $headers
  "{0}: fetched={1}, accepted={2}, rejected={3}, status={4}" -f $source.company, $run.fetched_count, $run.accepted_count, $run.rejected_count, $run.status
}
