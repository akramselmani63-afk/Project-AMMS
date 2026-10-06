$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) { throw 'Node.js is not installed or not available in PATH.' }
Write-Host "Using Node.js $nodeVersion"

$env:AMMS_ACCESS_MODE = 'server'
$env:AMMS_ACCESS_EMAIL_DOMAIN = 'example.com'
$env:AMMS_ACCESS_DATA_DIR = Join-Path $env:USERPROFILE 'Documents\AMMS-Access-Test'
$env:AMMS_ACCESS_ADMIN_TOKEN = (& node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))").Trim()
$env:AMMS_ACCESS_PORT = '4274'
$env:HOST = '127.0.0.1'
if (-not $env:AMMS_ACCESS_ADMIN_TOKEN) { throw 'Could not generate the account-administration key.' }
Write-Host "Account administration: http://127.0.0.1:4274/account-admin.html"
Write-Host "Administrator key (copy into that page): $env:AMMS_ACCESS_ADMIN_TOKEN" -ForegroundColor Yellow

npm run build
if ($LASTEXITCODE -ne 0) { throw 'AMMS build failed.' }

$server = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory (Get-Location).Path -PassThru -NoNewWindow
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($server.HasExited) { throw 'AMMS server stopped during startup. Check whether port 4274 is already in use.' }
        try {
            $status = Invoke-RestMethod -Uri 'http://127.0.0.1:4274/api/status' -TimeoutSec 1
            if ($status.mode -eq 'server') { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'AMMS did not become ready on port 4274.' }
    Start-Process 'http://127.0.0.1:4274/'
    Write-Host 'AMMS test server is running. Close this window to stop it.'
    Wait-Process -Id $server.Id
} finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id }
}
