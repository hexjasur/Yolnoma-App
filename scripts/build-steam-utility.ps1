param(
  [string]$Configuration = "Release",
  [string]$Runtime = "win-x64",
  [string]$Output = "src-tauri/resources/yolnoma_steamutility.dat"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$project = Join-Path $repo "libs/SteamUtility/SteamUtility.csproj"
$staging = Join-Path $repo ".build/steam-utility"
$archive = Join-Path $repo $Output

if (-not (Test-Path $project)) {
  throw "SteamUtility project not found: $project"
}

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$archiveParent = Split-Path $archive -Parent
New-Item -ItemType Directory -Force -Path $archiveParent | Out-Null
if (Test-Path $archive) { Remove-Item $archive -Force }

dotnet publish $project `
  --configuration $Configuration `
  --runtime $Runtime `
  --self-contained true `
  --output $staging `
  -p:PublishSingleFile=false

$required = @("SteamUtility.exe", "steam_api64.dll")
foreach ($name in $required) {
  $path = Join-Path $staging $name
  if (-not (Test-Path $path)) {
    throw "SteamUtility publish is incomplete; required file is missing: $name"
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  product = "Yolnoma SteamUtility"
  runtime = $Runtime
  configuration = $Configuration
  entryPoint = "SteamUtility.exe"
  nativeDependencies = @("steam_api64.dll")
  builtAtUtc = [DateTime]::UtcNow.ToString("o")
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $staging "manifest.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archive -CompressionLevel Optimal
if (-not (Test-Path $archive)) { throw "SteamUtility archive was not created: $archive" }

$hash = (Get-FileHash $archive -Algorithm SHA256).Hash
Write-Host "SteamUtility archive created: $archive"
Write-Host "SHA-256: $hash"
Write-Host "Files:"
Get-ChildItem $staging | Select-Object Name, Length
