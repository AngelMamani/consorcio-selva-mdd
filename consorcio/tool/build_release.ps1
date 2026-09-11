# Genera APK de release subiendo solo el código (+N).
# Uso: desde la carpeta consorcio →  powershell -File tool/build_release.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pubspec = Join-Path $root 'pubspec.yaml'
$content = Get-Content $pubspec -Raw
if ($content -notmatch 'version:\s*(\d+\.\d+\.\d+)\+(\d+)') {
  throw 'No se pudo leer version: x.y.z+N en pubspec.yaml'
}

$versionName = $Matches[1]
$oldCode = [int]$Matches[2]
$newCode = $oldCode + 1
$next = "version: $versionName+$newCode"

$content = [regex]::Replace(
  $content,
  'version:\s*\d+\.\d+\.\d+\+\d+',
  $next,
  1
)
Set-Content -Path $pubspec -Value $content -NoNewline

Write-Host "Versión: $versionName+$oldCode → $versionName+$newCode"
flutter pub get
if ($LASTEXITCODE -ne 0) { throw "flutter pub get falló" }
flutter build apk --release
if ($LASTEXITCODE -ne 0) { throw "flutter build apk --release falló" }

$apkSource = Join-Path $root 'build\app\outputs\flutter-apk\app-release.apk'
if (-not (Test-Path $apkSource)) {
  throw "No se generó el APK en $apkSource"
}
$releases = Join-Path (Split-Path -Parent $root) 'releases'
New-Item -ItemType Directory -Force -Path $releases | Out-Null
$apkTarget = Join-Path $releases "ConsorcioTecnico-$versionName+$newCode.apk"
Copy-Item -Force $apkSource $apkTarget

Write-Host ""
Write-Host "Listo: $apkTarget"
Write-Host "En App móvil solo sube ese APK: versión y código se leen solos."
Write-Host "Código de versión: $newCode (debe ser mayor que el publicado antes)."
