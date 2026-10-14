$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
$env:AMMS_TLS_PFX = Join-Path (Get-Location) '.https-test\server.pfx'
$env:AMMS_TLS_PASSWORD = (Get-Content '.https-test\password.txt' -Raw).Trim()
$env:AMMS_ACCESS_PUBLIC_URL = 'https://192.168.10.216:8443'
$env:AMMS_ACCESS_PORT = '8443'
$env:HOST = '192.168.10.216'
$env:AMMS_ACCESS_DATA_DIR = Join-Path $env:USERPROFILE 'Documents\AMMS-Access-Test'
$keyPath = '.https-test\admin-key.txt'
if (-not (Test-Path $keyPath)) { node -e "require('fs').writeFileSync('.https-test/admin-key.txt',require('crypto').randomBytes(32).toString('hex'))" }
$env:AMMS_ACCESS_ADMIN_TOKEN = (Get-Content $keyPath -Raw).Trim()
Write-Host 'agriMAINT phone test: https://192.168.10.216:8443'
Write-Host 'The admin key is stored locally in .https-test/admin-key.txt.'
node server.js
