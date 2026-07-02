$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$logDir = Join-Path $projectRoot "kitchen-print-agent\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Set-Location $projectRoot

while ($true) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $stdout = Join-Path $logDir "agent-$stamp.out.log"
  $stderr = Join-Path $logDir "agent-$stamp.err.log"
  $status = Join-Path $logDir "agent-service.log"

  Add-Content -LiteralPath $status -Value "[$(Get-Date -Format s)] starting kitchen print agent"

  try {
    $process = Start-Process `
      -FilePath "npm.cmd" `
      -ArgumentList @("run", "kitchen:print-agent") `
      -WorkingDirectory $projectRoot `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr

    Add-Content -LiteralPath $status -Value "[$(Get-Date -Format s)] agent exited with code $($process.ExitCode); restarting in 5 seconds"
  }
  catch {
    Add-Content -LiteralPath $status -Value "[$(Get-Date -Format s)] failed to start agent: $($_.Exception.Message); retrying in 10 seconds"
    Start-Sleep -Seconds 10
    continue
  }

  Start-Sleep -Seconds 5
}
