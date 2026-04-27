# HumanKey site deploy script.
#
# Usage: cd into d:\Project\HumanKey\site\ and run .\deploy.ps1
# First run will ask for GitHub repo URL. Subsequent runs just commit-push.
#
# Prerequisites: git installed, GitHub account, public repo created.

param(
    [string]$Message = "site update"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Initialize git on first run
if (-not (Test-Path ".git")) {
    Write-Host "First-time setup. Initializing git repo..." -ForegroundColor Cyan
    git init
    git checkout -b main 2>$null
    Write-Host ""
    Write-Host "Now provide your GitHub repo URL." -ForegroundColor Yellow
    Write-Host "Example: https://github.com/USERNAME/humankey-site.git" -ForegroundColor Gray
    $repoUrl = Read-Host "Repo URL"
    if (-not $repoUrl) {
        Write-Host "No URL provided. Aborting." -ForegroundColor Red
        exit 1
    }
    git remote add origin $repoUrl
    Write-Host "Remote added. First push will use --set-upstream." -ForegroundColor Green
}

# Stage everything
git add -A

# Skip empty commits
$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit. Site is up to date." -ForegroundColor Yellow
    exit 0
}

# Commit
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed. Check git config user.email / user.name." -ForegroundColor Red
    exit 1
}

# Push
$hasUpstream = git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
if (-not $hasUpstream) {
    Write-Host "First push: setting upstream to origin/main..." -ForegroundColor Cyan
    git push --set-upstream origin main
} else {
    git push
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host " Deploy complete!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps (one-time, only on first deploy):" -ForegroundColor Yellow
Write-Host " 1. Open your repo on github.com"
Write-Host " 2. Settings -> Pages"
Write-Host " 3. Source: 'Deploy from a branch'"
Write-Host " 4. Branch: 'main' / Folder: '/ (root)'"
Write-Host " 5. Click Save"
Write-Host ""
Write-Host " Site will be live in 1-2 min at:"
Write-Host "   https://USERNAME.github.io/REPO-NAME/" -ForegroundColor Cyan
