param(
  [string]$ApiUrl = "http://localhost:8000",
  [string]$IngestionKey = "development-ingestion-key"
)

$ErrorActionPreference = "Stop"
$headers = @{ "X-Ingestion-Key" = $IngestionKey; "Content-Type" = "application/json" }
$sources = @(
  @{ name = "Pushpay public careers"; adapter = "greenhouse"; identifier = "pushpay"; company = "Pushpay"; permission_basis = "Public Greenhouse job board API" },
  @{ name = "Cin7 public careers"; adapter = "lever"; identifier = "cin7"; company = "Cin7"; permission_basis = "Public Lever job board API" },
  @{ name = "Xero public careers"; adapter = "ashby"; identifier = "xero"; company = "Xero"; permission_basis = "Public Ashby job board API" },
  @{ name = "Partly public careers"; adapter = "ashby"; identifier = "partly.com"; company = "Partly"; permission_basis = "Public Ashby job board API" },
  @{ name = "Halter public careers"; adapter = "ashby"; identifier = "halter"; company = "Halter"; permission_basis = "Public Ashby job board API" },
  @{ name = "Auror public careers"; adapter = "ashby"; identifier = "auror"; company = "Auror"; permission_basis = "Public Ashby job board API" },
  @{ name = "Ticketure public careers"; adapter = "ashby"; identifier = "ticketure"; company = "Ticketure"; permission_basis = "Public Ashby job board API" }
  @{ name = "Air New Zealand public careers"; adapter = "smartrecruiters"; identifier = "AirNewZealand"; company = "Air New Zealand"; permission_basis = "Public SmartRecruiters job posting API" },
  @{ name = "Meridian Energy public careers"; adapter = "smartrecruiters"; identifier = "MeridianEnergy1"; company = "Meridian Energy"; permission_basis = "Public SmartRecruiters job posting API" },
  @{ name = "Vector public careers"; adapter = "smartrecruiters"; identifier = "VectorLimited"; company = "Vector"; permission_basis = "Public SmartRecruiters job posting API" },
  @{ name = "University of Auckland public careers"; adapter = "smartrecruiters"; identifier = "TheUniversityOfAuckland"; company = "University of Auckland"; permission_basis = "Public SmartRecruiters job posting API linked from the university careers site" },
  @{ name = "Fisher and Paykel Appliances public careers"; adapter = "workday"; identifier = "https://haier.wd3.myworkdayjobs.com/FPA_External_Career_Site"; company = "Fisher & Paykel Appliances"; permission_basis = "Public Workday careers API used by the company careers site" },
  @{ name = "Octopus Deploy public careers"; adapter = "greenhouse"; identifier = "octopusdeploy"; company = "Octopus Deploy"; permission_basis = "Public Greenhouse job board API" },
  @{ name = "Vista Group public careers"; adapter = "workable"; identifier = "vista-group"; company = "Vista Group"; permission_basis = "Public Workable careers API used by the company careers site" }
)

foreach ($source in $sources) {
  $body = $source | ConvertTo-Json
  try {
    $created = Invoke-RestMethod "$ApiUrl/api/v1/market/collectors" -Method Post -Headers $headers -Body $body
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
      $identifier = [string]$source["identifier"]
      $registered = @(Invoke-RestMethod "$ApiUrl/api/v1/market/collectors" -Method Get -Headers $headers)[0]
      $created = $registered | Where-Object { [string]$_.identifier -eq $identifier } | Select-Object -First 1
      if (-not $created) { throw "Registered source '$identifier' could not be resolved." }
    } else { throw }
  }
  $sourceId = [string](($created | Select-Object -First 1).id)
  $run = Invoke-RestMethod "$ApiUrl/api/v1/market/collectors/$sourceId/run" -Method Post -Headers $headers
  "{0}: fetched={1}, accepted={2}, rejected={3}, status={4}" -f $source.company, $run.fetched_count, $run.accepted_count, $run.rejected_count, $run.status
}
