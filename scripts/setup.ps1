# camscanner-cli installer for Windows
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# Environment variables (all optional):
#   CAMSCANNER_CLI_VERSION - version to install (default: read from SKILL.md)
#   CAMSCANNER_CLI_CDN     - CDN base URL override
#   CAMSCANNER_CLI_DIR     - install directory override (default: %LOCALAPPDATA%\camscanner-cli)

$ErrorActionPreference = "Stop"

$CdnBase = if ($env:CAMSCANNER_CLI_CDN) { $env:CAMSCANNER_CLI_CDN } else { "https://data.camscanner.com/camscanner-cli/releases" }
$BinName = "camscanner-cli"
$DefaultInstallDir = Join-Path $env:LOCALAPPDATA "camscanner-cli"
$InstallDir = if ($env:CAMSCANNER_CLI_DIR) { $env:CAMSCANNER_CLI_DIR } else { $DefaultInstallDir }

# Helpers

function Write-Say  { param([string]$Message) Write-Host "  $Message" }
function Write-Err  { param([string]$Message) Write-Host "  [ERROR] $Message" -ForegroundColor Red; exit 1 }

function Get-Arch {
    if ($env:CAMSCANNER_CLI_ARCH) {
        $override = $env:CAMSCANNER_CLI_ARCH.ToLower()
        if ($override -eq "amd64" -or $override -eq "arm64") { return $override }
        Write-Err "Invalid CAMSCANNER_CLI_ARCH '$env:CAMSCANNER_CLI_ARCH'. Must be 'amd64' or 'arm64'."
    }
    try {
        $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
        switch ($arch.ToString()) {
            "X64"   { return "amd64" }
            "Arm64" { return "arm64" }
        }
    } catch {}
    $envArch = $env:PROCESSOR_ARCHITECTURE
    if ($envArch) {
        switch ($envArch.ToUpper()) {
            "AMD64" { return "amd64" }
            "ARM64" { return "arm64" }
            "X86"   {
                $realArch = $env:PROCESSOR_ARCHITEW6432
                if ($realArch) {
                    switch ($realArch.ToUpper()) {
                        "AMD64" { return "amd64" }
                        "ARM64" { return "arm64" }
                    }
                }
                Write-Err "32-bit Windows is not supported."
            }
        }
    }
    Write-Err "Could not detect architecture. Set CAMSCANNER_CLI_ARCH to 'amd64' or 'arm64'."
}

function Resolve-SkillVersion {
    if ($env:CAMSCANNER_CLI_VERSION) { return $env:CAMSCANNER_CLI_VERSION }
    $searchPaths = @()
    if ($PSScriptRoot) {
        $searchPaths += Join-Path $PSScriptRoot "..\SKILL.md"
        $searchPaths += Join-Path $PSScriptRoot "..\..\SKILL.md"
    }
    $searchPaths += ".\SKILL.md"
    foreach ($candidate in $searchPaths) {
        if (Test-Path $candidate) {
            $lines = Get-Content $candidate -TotalCount 20
            foreach ($line in $lines) {
                if ($line -match '^version:\s*"?([^"]+)"?\s*$') {
                    return $Matches[1].Trim()
                }
                if ($line -match '^metadata:\s*\{.*"version"\s*:\s*"([^"]+)".*\}\s*$') {
                    return $Matches[1].Trim()
                }
            }
        }
    }
    Write-Err "Cannot determine version. Set CAMSCANNER_CLI_VERSION explicitly."
}

function Test-VersionGe {
    param([string]$Installed, [string]$Target)
    try {
        return ([version]$Installed -ge [version]$Target)
    } catch {
        return $false
    }
}

function Test-ExistingInstall {
    param([string]$TargetVersion)
    $existing = Get-Command $BinName -ErrorAction SilentlyContinue
    if ($existing) {
        $existingVer = & $BinName --version 2>$null | Select-Object -First 1
        if (-not $existingVer) { $existingVer = "0.0.0" }
        if ($existingVer -eq $TargetVersion) {
            Write-Say "$BinName v$TargetVersion is already installed at $($existing.Source)"
            exit 0
        }
        if (Test-VersionGe -Installed $existingVer -Target $TargetVersion) {
            Write-Say "Installed $BinName v$existingVer >= target v$TargetVersion, skipping."
            exit 0
        }
        Write-Say "Found existing $BinName v$existingVer at $($existing.Source)"
        Write-Say "Will upgrade to v$TargetVersion to $InstallDir\"
    }
}

# Main

$Arch = Get-Arch
$Version = Resolve-SkillVersion

Test-ExistingInstall -TargetVersion $Version

# Artifact naming matches the Makefile: camscanner-cli-windows-{arch}.exe
$BinFile = "${BinName}-windows-${Arch}.exe"
$DownloadUrl = "${CdnBase}/v${Version}/${BinFile}"

Write-Say "Installing ${BinName} v${Version} (windows/${Arch})..."
Write-Say "Target: ${InstallDir}\${BinName}.exe"

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "camscanner-cli-install-$PID"
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

try {
    $DestFile = Join-Path $TmpDir $BinFile

    Write-Say "Downloading ${BinFile}..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $DestFile -UseBasicParsing

    if (!(Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $DestBin = Join-Path $InstallDir "${BinName}.exe"
    Copy-Item -Path $DestFile -Destination $DestBin -Force

    Write-Say "[OK] Installed: $DestBin"

    # Add to user PATH if not already there
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Say ""
        Write-Say "Adding $InstallDir to user PATH..."
        [Environment]::SetEnvironmentVariable("PATH", "$InstallDir;$UserPath", "User")
        $env:PATH = "$InstallDir;$env:PATH"
        Write-Say "[OK] PATH updated (restart terminal for full effect)"
    }

    Write-Say ""
    Write-Say "${BinName} v${Version} ready!"
    Write-Say "  Run: ${BinName} --version"
    Write-Say "  Login: ${BinName} auth login"

} finally {
    Remove-Item -Path $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
