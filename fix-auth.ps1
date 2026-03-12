$OLD = 'from "@/app/api/auth/[...nextauth]/route"'
$NEW = 'from "@/lib/auth"'
$fixedCount = 0
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($null -ne $content -and $content.Contains($OLD)) {
        $newContent = $content.Replace($OLD, $NEW)
        [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host ("OK: " + $file.Name)
        $fixedCount++
    }
}
Write-Host ("완료: " + $fixedCount + "개 파일 수정")
