param(
  [string]$Seed = "",
  [string]$SeedsFile = "local-brain/seeds.txt",
  [string]$DraftDir = "local-brain/drafts",
  [switch]$Overwrite,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
  param(
    [string]$Label,
    [scriptblock]$Command
  )

  Write-Step $Label
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

$Seeds = @()

if (-not [string]::IsNullOrWhiteSpace($Seed)) {
  $Seeds += $Seed
} elseif (Test-Path -LiteralPath $SeedsFile) {
  $Seeds = Get-Content -LiteralPath $SeedsFile -Encoding UTF8 |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and -not $_.Trim().StartsWith("#") }
} else {
  throw "No seed was provided and $SeedsFile does not exist. Create it from local-brain/seeds.example.txt or pass -Seed."
}

if ($Seeds.Count -eq 0) {
  throw "No usable seed keywords found."
}

Write-Step "Generating local insight drafts"

foreach ($Item in $Seeds) {
  $Args = @("scripts/local-brain/generate-insight.py", "--seed", $Item, "--draft-dir", $DraftDir)

  if ($Overwrite) {
    $Args += "--overwrite"
  }

  & python @Args

  if ($LASTEXITCODE -ne 0) {
    throw "Generation failed for seed: $Item"
  }
}

Invoke-Checked "Validating draft folder" {
  & npm.cmd run brain:add-batch -- --dry-run $DraftDir
}

if ($Publish) {
  Invoke-Checked "Publishing generated drafts" {
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-insights.ps1
  }
} else {
  Write-Step "Done"
  Write-Host "Drafts were generated and validated. Review local-brain/drafts, then run publish-insights.bat when ready."
}
