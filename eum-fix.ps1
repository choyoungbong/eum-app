# eum-fix.ps1
# EUM 앱 authOptions import 경로 일괄 수정
# 실행: PowerShell에서 프로젝트 루트(D:\projects\personal-cloud\apps\web)로 이동 후
#       .\eum-fix.ps1
# 실행 정책 오류 시: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"

$OLD = 'from "@/app/api/auth/[...nextauth]/route"'
$NEW = 'from "@/lib/auth"'

Write-Host "=== EUM authOptions import 경로 일괄 수정 ===" -ForegroundColor Green
Write-Host ""

$files = Get-ChildItem -Path "src" -Recurse -Filter "*.ts" |
         Where-Object { $_.FullName -notmatch "node_modules|\.next|dist" }

$fixedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -match [regex]::Escape($OLD)) {
        $newContent = $content -replace [regex]::Escape($OLD), $NEW
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
        Write-Host "  ✅ $($file.FullName -replace [regex]::Escape((Get-Location).Path + '\'), '')" -ForegroundColor Cyan
        $fixedCount++
    }
}

# TSX 파일도 처리
$tsxFiles = Get-ChildItem -Path "src" -Recurse -Filter "*.tsx" |
            Where-Object { $_.FullName -notmatch "node_modules|\.next|dist" }

foreach ($file in $tsxFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -match [regex]::Escape($OLD)) {
        $newContent = $content -replace [regex]::Escape($OLD), $NEW
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
        Write-Host "  ✅ $($file.FullName -replace [regex]::Escape((Get-Location).Path + '\'), '')" -ForegroundColor Cyan
        $fixedCount++
    }
}

Write-Host ""
Write-Host "총 ${fixedCount}개 파일 수정 완료" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  1. git diff 로 변경사항 확인"
Write-Host "  2. npm run build 로 빌드 테스트"
Write-Host "  3. git add -A; git commit -m fix_authOptions_import_path"
