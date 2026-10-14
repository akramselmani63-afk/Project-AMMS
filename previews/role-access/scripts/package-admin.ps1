$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
$output = Join-Path $project 'dist\agriMAINT-Admin.exe'
New-Item -ItemType Directory -Force (Split-Path -Parent $output) | Out-Null
& $compiler /nologo /target:winexe /define:ADMIN "/out:$output" "/win32icon:$(Join-Path $project 'assets\amms-app-icon.ico')" /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'AMMSLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not compile the administration executable.' }
Write-Output "Created $output"
