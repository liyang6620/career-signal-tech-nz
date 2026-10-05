param(
  [string]$ApiUrl = "http://localhost:8001",
  [switch]$SkipDatabaseReadiness
)

$ErrorActionPreference = "Stop"

function Assert-Endpoint([string]$Path) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri "$ApiUrl$Path" -TimeoutSec 10
  if ($response.StatusCode -ne 200) {
    throw "$Path returned HTTP $($response.StatusCode)"
  }
  Write-Host "PASS $Path"
}

Assert-Endpoint "/health"
if (-not $SkipDatabaseReadiness) {
  Assert-Endpoint "/ready"
}

$metrics = Invoke-WebRequest -UseBasicParsing -Uri "$ApiUrl/metrics" -TimeoutSec 10
if ($metrics.StatusCode -ne 200 -or $metrics.Content -notmatch "careersignal_http_requests_total") {
  throw "/metrics did not return the expected Prometheus counters"
}
Write-Host "PASS /metrics"
Write-Host "CareerSignal API smoke checks passed."
