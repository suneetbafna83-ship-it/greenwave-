# GreenWave 3D Checkpoint Restore & Time Machine Utility
# Usage examples:
#   .\restore-checkpoint.ps1 -List
#   .\restore-checkpoint.ps1 -Checkpoint 06
#   .\restore-checkpoint.ps1 -Checkpoint edit-08

param(
    [Parameter(Position=0)]
    [string]$Checkpoint = "",
    [switch]$List
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  GREENWAVE 3D: CHECKPOINT TIME MACHINE" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

$checkpoints = @(
    @{ Edit = "01"; Tag = "edit-01"; Date = "2026-10-29 15:58:33"; Desc = "Initial 7x7 Grid, 49 Junctions, 3-Junction Pre-Flush, Supabase/Gemini Dual SDK" }
    @{ Edit = "02"; Tag = "edit-02"; Date = "2026-10-29 17:12:01"; Desc = "11x11 Grid (121 Junctions), Potholes & Speed Breakers, 6 Vehicle Classes" }
    @{ Edit = "03"; Tag = "edit-03"; Date = "2026-10-29 17:42:06"; Desc = "Emergency Red Light vs Ambulance Visual Deconfliction & Strobe Beacon" }
    @{ Edit = "04"; Tag = "edit-04"; Date = "2026-10-29 17:56:22"; Desc = "34m Traffic Projection Beam & Street-Level Chase-Cam" }
    @{ Edit = "05"; Tag = "edit-05"; Date = "2026-10-29 18:10:19"; Desc = "15x15 Grid (225 Junctions), Strict Stop Line Clamping, Dynamic A* Routing" }
    @{ Edit = "06"; Tag = "edit-06"; Date = "2026-10-29 19:30:00"; Desc = "100x100 Cross Map (625 Junctions), Slum District, 2D Radar Minimap" }
    @{ Edit = "07"; Tag = "edit-07"; Date = "2026-10-29 20:45:00"; Desc = "Organic Slum Field, 24-Hr Continuous Solar Cycle & Zero-GC Vector Math" }
    @{ Edit = "08"; Tag = "edit-08"; Date = "2026-10-29 21:15:00"; Desc = "500x500 Cross Grid (961 Junctions), Meandering River & Suspension Bridges" }
    @{ Edit = "09"; Tag = "edit-09"; Date = "2026-10-29 21:40:00"; Desc = "60 FPS Ultra-Smooth Camera Engine, Zero-Stutter Minimap & Checkpoint Vault (CURRENT)" }
)

if ($List -or [string]::IsNullOrWhiteSpace($Checkpoint)) {
    Write-Host "`nAvailable Checkpoints in Git Vault:`n" -ForegroundColor Yellow
    foreach ($cp in $checkpoints) {
        $marker = if ($cp.Edit -eq "09") { "[CURRENT]" } else { "         " }
        Write-Host "  $marker Edit $($cp.Edit) ($($cp.Tag)) | $($cp.Date) | $($cp.Desc)" -ForegroundColor White
    }
    Write-Host "`nTo inspect any checkpoint, run:" -ForegroundColor Cyan
    Write-Host "  .\restore-checkpoint.ps1 -Checkpoint 06" -ForegroundColor Green
    Write-Host "  or run git checkout edit-06`n" -ForegroundColor Gray
    Write-Host "To return to the latest version at any time, run:" -ForegroundColor Cyan
    Write-Host "  git checkout main`n" -ForegroundColor Green
    exit 0
}

# Normalize checkpoint input (e.g. '06', '6', 'edit-06')
$targetTag = $Checkpoint
if ($Checkpoint -match '^\d+$') {
    $num = [int]$Checkpoint
    $targetTag = "edit-{0:D2}" -f $num
}

$found = $checkpoints | Where-Object { $_.Tag -eq $targetTag -or $_.Edit -eq $Checkpoint }
if (-not $found) {
    Write-Host "Error: Checkpoint '$Checkpoint' not recognized." -ForegroundColor Red
    Write-Host "Run .\restore-checkpoint.ps1 -List to see all available checkpoints." -ForegroundColor Yellow
    exit 1
}

Write-Host "Selected Target: $($found.Tag) - $($found.Desc)" -ForegroundColor Yellow
Write-Host "Switching working tree to $($found.Tag)..." -ForegroundColor White

git checkout $found.Tag

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccessfully switched to $($found.Tag)!" -ForegroundColor Green
    Write-Host "Your Vite dev server will hot-reload to this version automatically." -ForegroundColor Cyan
    Write-Host "When you want to return to the latest version, simply run:" -ForegroundColor Yellow
    Write-Host "  git checkout main`n" -ForegroundColor Green
} else {
    Write-Host "`nGit checkout failed. If you have uncommitted edits, run git stash first." -ForegroundColor Red
}
