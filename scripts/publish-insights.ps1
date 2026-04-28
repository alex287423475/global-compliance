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

Write-Step "Checking workspace"

if (-not (Test-Path -LiteralPath $DraftDir)) {
  throw "Draft directory does not exist: $DraftDir"
}

$DraftFiles = Get-ChildItem -LiteralPath $DraftDir -Filter "*.json" -File

if ($DraftFiles.Count -eq 0) {
  throw "No JSON draft files found in $DraftDir"
}

if (-not $Force) {
  $DirtyStatus = @(git status --porcelain)
  if ($DirtyStatus.Count -gt 0) {
    Write-Host "Workspace has local changes. Publish will stage only website content and public insight assets." -ForegroundColor Yellow
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

Invoke-Checked "Building site" {
  & npm.cmd run build
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
  $CommitMessage = "Publish compliance insights $(Get-Date -Format 'yyyy-MM-dd HHmm')"
}

Invoke-Checked "Staging changes" {
  $StageTargets = @("content/insights.ts")
  if (Test-Path -LiteralPath "public/insights") {
    $StageTargets += "public/insights"
  }
  & git add -- $StageTargets
}

$StagedStatus = @(git diff --cached --name-only)

if ($StagedStatus.Count -gt 0) {
  Invoke-Checked "Committing" {
    & git commit -m $CommitMessage
  }
} else {
  Write-Step "No staged changes"
  Write-Host "No new website content needed a commit. Push will still run in case the local branch is ahead of GitHub."
}

if ($NoPush) {
  Write-Step "Done"
  Write-Host "Publish flow completed locally. Push was skipped because -NoPush was set."
  exit 0
}

Invoke-Checked "Pushing to GitHub" {
  Push-WithFallback
}

Write-Step "Done"
Write-Host "Insights were imported, built, committed, and pushed. Vercel will deploy automatically."
