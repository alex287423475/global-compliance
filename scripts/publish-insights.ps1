param(
  [string]$DraftDir = "local-brain/drafts",
  [string]$CommitMessage = "",
  [switch]$CheckOnly,
  [switch]$NoPush,
  [switch]$Force
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

function Push-WithFallback {
  & git push
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Host "Default git push failed. Retrying with OpenSSL backend..." -ForegroundColor Yellow
  & git -c http.sslBackend=openssl push
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed after OpenSSL retry"
  }
}

function Get-GitStatusPath {
  param([string]$Line)

  if ($Line.Length -le 3) {
    return ""
  }

  return $Line.Substring(3).Trim()
}

Write-Step "Checking workspace"

if (-not (Test-Path -LiteralPath $DraftDir)) {
  throw "Draft directory does not exist: $DraftDir"
}

$DraftFiles = Get-ChildItem -LiteralPath $DraftDir -Filter "*.json" -File

if ($DraftFiles.Count -eq 0) {
  throw "No JSON draft files found in $DraftDir"
}

$InitialStatus = @(git status --porcelain)

if (-not $Force) {
  $BlockedChanges = @(
    $InitialStatus | Where-Object {
      $Path = Get-GitStatusPath $_
      $NormalizedPath = $Path -replace "\\", "/"
      $NormalizedPath -ne "" -and -not $NormalizedPath.StartsWith("local-brain/drafts/")
    }
  )

  if ($BlockedChanges.Count -gt 0) {
    Write-Host "Unrelated local changes were found. Commit or stash them first, or rerun with -Force." -ForegroundColor Yellow
    $BlockedChanges | ForEach-Object { Write-Host "  $_" }
    exit 1
  }
}

Invoke-Checked "Dry-run import check" {
  & npm.cmd run brain:add-batch -- --dry-run $DraftDir
}

if ($CheckOnly) {
  Write-Step "Check complete"
  Write-Host "Draft validation passed. No files were changed because -CheckOnly was set."
  exit 0
}

Invoke-Checked "Importing insight drafts" {
  & npm.cmd run brain:add-batch -- $DraftDir
}

$ContentStatus = @(git status --porcelain -- content/insights.ts)

if ($ContentStatus.Count -eq 0) {
  Write-Step "No new articles"
  Write-Host "All draft slugs already exist in content/insights.ts. Nothing was published."
  exit 0
}

Invoke-Checked "Building site" {
  & npm.cmd run build
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
  $CommitMessage = "Publish compliance insights $(Get-Date -Format 'yyyy-MM-dd HHmm')"
}

Invoke-Checked "Staging changes" {
  & git add -- content/insights.ts $DraftDir
}

$StagedStatus = @(git diff --cached --name-only)

if ($StagedStatus.Count -eq 0) {
  Write-Step "No staged changes"
  Write-Host "Nothing to commit."
  exit 0
}

Invoke-Checked "Committing" {
  & git commit -m $CommitMessage
}

if ($NoPush) {
  Write-Step "Done"
  Write-Host "Committed locally. Push was skipped because -NoPush was set."
  exit 0
}

Invoke-Checked "Pushing to GitHub" {
  Push-WithFallback
}

Write-Step "Done"
Write-Host "Insights were imported, built, committed, and pushed. Vercel will deploy automatically."
