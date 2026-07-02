$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceApk = Join-Path $projectRoot "sunmi-v2-wrapper\app\build\outputs\apk\debug\app-debug.apk"
$downloadDir = Join-Path $projectRoot "public\downloads"
$targetApk = Join-Path $downloadDir "teeuan-sunmi-v2.apk"

if (-not (Test-Path $sourceApk)) {
  throw "APK not found: $sourceApk. Build it first from sunmi-v2-wrapper."
}

New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force

$apk = Get-Item -LiteralPath $targetApk
Write-Host "Published SUNMI APK:"
Write-Host "  $($apk.FullName)"
Write-Host "  Size: $([Math]::Round($apk.Length / 1MB, 2)) MB"
Write-Host "  Updated: $($apk.LastWriteTime)"
