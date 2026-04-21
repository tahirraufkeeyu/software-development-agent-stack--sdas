# install-remote.ps1 — PowerShell installer for skillskit on Windows.
#
# Usage (PowerShell 5.1+ or PowerShell 7+):
#
#   iwr https://skillskit.dev/install.ps1 -useb | iex
#
# Behaviour:
#
#   1. Detects the architecture (amd64 or arm64).
#   2. Downloads the matching archive from the latest GitHub Release.
#   3. Verifies the SHA256 checksum against the release's checksums.txt.
#   4. Extracts skillskit.exe into $InstallDir (default: $env:LOCALAPPDATA
#      \Programs\skillskit).
#   5. Adds the install directory to the user's PATH (persistent across
#      shells) if not already present.
#
# Optional env vars:
#
#   $env:SKILLSKIT_VERSION    Install a specific version (e.g. "v0.1.0")
#   $env:INSTALL_DIR          Override install directory
#   $env:SKIP_VERIFY          Set to "1" to skip checksum verification
#
# Exit codes:
#
#   0  success
#   1  generic failure
#   2  unsupported architecture
#   3  checksum mismatch

$ErrorActionPreference = 'Stop'

$Repo = 'tahirraufkeeyu/software-development-agent-stack--sdas'
$Binary = 'skillskit.exe'

function Info($msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Fail($msg, $code = 1) {
  Write-Host "error: $msg" -ForegroundColor Red
  exit $code
}

# --- prereqs ---------------------------------------------------------

if (-not (Get-Command Expand-Archive -ErrorAction SilentlyContinue)) {
  Fail 'PowerShell 5.0 or later is required (Expand-Archive missing).'
}

# --- version resolution ---------------------------------------------

$Version = if ($env:SKILLSKIT_VERSION) { $env:SKILLSKIT_VERSION } else { $null }
if (-not $Version) {
  Info 'resolving latest skillskit release...'
  try {
    $resp = Invoke-WebRequest -Uri "https://github.com/$Repo/releases/latest" `
              -MaximumRedirection 0 -ErrorAction SilentlyContinue
  } catch {
    $resp = $_.Exception.Response
  }
  if ($resp -and $resp.Headers.Location) {
    $loc = $resp.Headers.Location
    if ($loc -is [System.Collections.IEnumerable] -and -not ($loc -is [string])) {
      $loc = $loc[0]
    }
    $Version = ($loc -split '/')[-1]
  }
  if (-not $Version) {
    Fail 'could not resolve latest release; set $env:SKILLSKIT_VERSION manually.'
  }
}
Info "installing skillskit $Version"

$VersionNumber = $Version -replace '^v', ''

# --- arch detection --------------------------------------------------

switch ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture) {
  'X64'   { $Arch = 'x86_64' }
  'Arm64' { $Arch = 'arm64' }
  default {
    Fail "unsupported architecture: $_" 2
  }
}

$Archive = "skillskit_${VersionNumber}_windows_${Arch}.zip"
$Url = "https://github.com/$Repo/releases/download/$Version/$Archive"
$ChecksumUrl = "https://github.com/$Repo/releases/download/$Version/checksums.txt"

# --- download --------------------------------------------------------

$Tmp = Join-Path $env:TEMP "skillskit-install-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
try {
  $ArchivePath = Join-Path $Tmp $Archive
  Info "downloading $Archive"
  Invoke-WebRequest -Uri $Url -OutFile $ArchivePath -UseBasicParsing

  # --- verify checksum -----------------------------------------------

  if ($env:SKIP_VERIFY -ne '1') {
    Info 'verifying checksum'
    $ChecksumPath = Join-Path $Tmp 'checksums.txt'
    Invoke-WebRequest -Uri $ChecksumUrl -OutFile $ChecksumPath -UseBasicParsing
    $expectedLine = Get-Content $ChecksumPath | Where-Object { $_ -match "\s$([regex]::Escape($Archive))$" } | Select-Object -First 1
    if (-not $expectedLine) {
      Fail 'archive not found in checksums.txt'
    }
    $Expected = ($expectedLine -split '\s+')[0]
    $Actual = (Get-FileHash -Algorithm SHA256 $ArchivePath).Hash.ToLower()
    if ($Actual -ne $Expected.ToLower()) {
      Fail "checksum mismatch! expected=$Expected actual=$Actual" 3
    }
  } else {
    Info 'skipping checksum verification (SKIP_VERIFY=1)'
  }

  # --- extract -------------------------------------------------------

  Info 'extracting'
  Expand-Archive -Path $ArchivePath -DestinationPath $Tmp -Force
  $BinarySrc = Join-Path $Tmp $Binary
  if (-not (Test-Path $BinarySrc)) {
    Fail "binary $Binary not found in archive"
  }

  # --- install to PATH -----------------------------------------------

  $InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else {
    Join-Path $env:LOCALAPPDATA 'Programs\skillskit'
  }
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Copy-Item -Path $BinarySrc -Destination (Join-Path $InstallDir $Binary) -Force
  Info "installed $Binary $Version to $InstallDir"

  # --- add to user PATH if missing -----------------------------------

  $UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @()
  if ($UserPath) { $parts = $UserPath -split ';' | Where-Object { $_ } }
  if ($parts -notcontains $InstallDir) {
    $NewPath = ($parts + $InstallDir) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
    Info "added $InstallDir to your user PATH"
    Write-Host ""
    Write-Host "Open a NEW terminal window for the PATH change to take effect." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "Next: skillskit install all"
  Write-Host "      skillskit --help"
}
finally {
  Remove-Item -Path $Tmp -Recurse -Force -ErrorAction SilentlyContinue
}
