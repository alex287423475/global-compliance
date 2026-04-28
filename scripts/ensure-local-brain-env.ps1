$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$VenvPython = Join-Path $RepoRoot ".venv-local-brain\Scripts\python.exe"

function Find-Python310 {
  if ($env:LOCAL_BRAIN_PYTHON -and (Test-Path -LiteralPath $env:LOCAL_BRAIN_PYTHON)) {
    return $env:LOCAL_BRAIN_PYTHON
  }

  $BundledPython = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
  if (Test-Path -LiteralPath $BundledPython) {
    return $BundledPython
  }

  foreach ($Candidate in @("py -3.12", "py -3.11", "py -3.10", "python")) {
    $Parts = $Candidate.Split(" ")
    $Exe = $Parts[0]
    $Args = @()
    if ($Parts.Count -gt 1) {
      $Args = $Parts[1..($Parts.Count - 1)]
    }

    try {
      $Version = & $Exe @Args -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
      if ($LASTEXITCODE -eq 0) {
        $MajorMinor = [version]$Version
        if ($MajorMinor -ge [version]"3.10") {
          return $Candidate
        }
      }
    } catch {
    }
  }

  throw "LangGraph requires Python 3.10+. Set LOCAL_BRAIN_PYTHON to a Python 3.10+ executable, or install Python 3.12."
}

function Invoke-Python {
  param(
    [string]$PythonCommand,
    [string[]]$PythonArgs
  )

  $Parts = $PythonCommand.Split(" ")
  $Exe = $Parts[0]
  $Args = @()
  if ($Parts.Count -gt 1) {
    $Args = $Parts[1..($Parts.Count - 1)]
  }

  & $Exe @Args @PythonArgs
}

if (-not (Test-Path -LiteralPath $VenvPython)) {
  $BasePython = Find-Python310
  Write-Host "Creating local brain environment with $BasePython"
  Invoke-Python $BasePython @("-m", "venv", ".venv-local-brain")
}

$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$Check = & $VenvPython -c "import langgraph; print('ok')" 2>$null
$ImportExitCode = $LASTEXITCODE
$ErrorActionPreference = $PreviousErrorActionPreference

if ($ImportExitCode -ne 0 -or $Check -ne "ok") {
  Write-Host "Installing local brain dependencies..."
  & $VenvPython -m pip install -r requirements-local-brain.txt
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
  }
}

Write-Host "Local brain environment is ready: $VenvPython"
