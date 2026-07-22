# Sync .env.local → Vercel project "vocational" (production + preview)
# Requires: vercel login (or VERCEL_TOKEN)
# Usage: pwsh -File scripts/sync-vercel-env.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root '.env.local'))) {
  $root = Get-Location
}
$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$team = 'ebrines-projects-d0493afe'
$project = 'vocational'

# Prefer www (apex redirects to www)
$forceOverrides = @{
  PUBLIC_SITE_URL = 'https://www.scmtvet.com'
}

function Get-EnvMap([string]$path) {
  $map = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
    $map[$k] = $v
  }
  return $map
}

$map = Get-EnvMap $envFile
foreach ($k in $forceOverrides.Keys) { $map[$k] = $forceOverrides[$k] }

$required = @(
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'PUBLIC_SITE_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM'
)

foreach ($k in $required) {
  if (-not $map.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($map[$k])) {
    throw "Missing required key in .env.local: $k"
  }
}

Write-Host "Syncing $($required.Count) env vars to Vercel project '$project' (team $team)..."

foreach ($key in $required) {
  $value = $map[$key]
  Write-Host "`n=== $key ==="

  # Remove existing for production + preview (ignore errors if missing)
  foreach ($envName in @('production', 'preview', 'development')) {
    vercel env rm $key $envName --yes --scope $team 2>$null | Out-Null
  }

  # Add to production + preview + development via stdin
  $value | vercel env add $key production preview development --scope $team --sensitive 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    # Older CLI may not support multi-env / --sensitive; fall back per env
    foreach ($envName in @('production', 'preview', 'development')) {
      Write-Host "  fallback add $key → $envName"
      $value | vercel env add $key $envName --scope $team 2>&1 | Out-Host
    }
  }
}

Write-Host "`nListing env var names on project..."
vercel env ls --scope $team 2>&1 | Out-Host

Write-Host "`nDone. Redeploy production so VITE_* vars bake into the client bundle."
