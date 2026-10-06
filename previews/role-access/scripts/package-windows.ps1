$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$portable = Join-Path $project 'AMMS-Access-Preview.html'
$icon = Join-Path $project 'assets\amms-app-icon.ico'
$output = Join-Path $project 'dist\AMMS-Access-Preview.exe'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $compiler)) { throw 'The Windows .NET Framework compiler was not found.' }

Push-Location $project
try {
    npm run portable
    if (-not (Test-Path -LiteralPath $icon)) { & (Join-Path $PSScriptRoot 'create-icon.ps1') }
    & (Join-Path $PSScriptRoot 'create-icon.ps1')
    if (-not (Test-Path $portable)) { throw 'Portable AMMS file was not generated.' }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $output) | Out-Null
    $resourceArg = "/resource:$portable,AMMS-Access-Preview.html"
    & $compiler /nologo /target:winexe "/out:$output" "/win32icon:$icon" /reference:System.Windows.Forms.dll $resourceArg (Join-Path $PSScriptRoot 'AMMSLauncher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Could not compile AMMS-Access-Preview.exe.' }
    Write-Output "Created $output"
}
finally { Pop-Location }
