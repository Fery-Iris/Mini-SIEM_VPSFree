# run_daemon.ps1
# This script runs the Mini-SIEM backend as a persistent daemon.
# It automatically restarts the process if it crashes or is killed.

$BackendExe = ".\mini-siem-be.exe"
$LogFile = ".\daemon.log"

Write-Output "Starting Mini-SIEM Backend Watchdog..." | Out-File -FilePath $LogFile -Append

while ($true) {
    try {
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $Message = "[$Timestamp] Starting $BackendExe..."
        Write-Host $Message -ForegroundColor Green
        $Message | Out-File -FilePath $LogFile -Append

        # Start the backend process and wait for it to exit
        $Process = Start-Process -FilePath $BackendExe -Wait -NoNewWindow -PassThru

        # If it reaches here, the process exited
        $ExitCode = $Process.ExitCode
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $Message = "[$Timestamp] Process exited with code $ExitCode. Restarting in 5 seconds..."
        Write-Host $Message -ForegroundColor Yellow
        $Message | Out-File -FilePath $LogFile -Append

    } catch {
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $Message = "[$Timestamp] Error starting process: $_. Retrying in 5 seconds..."
        Write-Host $Message -ForegroundColor Red
        $Message | Out-File -FilePath $LogFile -Append
    }

    # Wait before restarting to prevent rapid crash looping CPU spikes
    Start-Sleep -Seconds 5
}
