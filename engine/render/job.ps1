# Runs one render job inside the interactive desktop session (launched by the OpusFilmRender scheduled task).
$job = 'E:\opus_film\job'
$argline = (Get-Content "$job\args.txt" -Raw).Trim()
Set-Location E:\opus_film\app\engine\render
"START $(Get-Date -Format o) $argline" | Out-File "$job\job.log" -Encoding utf8
$p = Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList "render.mjs $argline" -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput "$job\out.log" -RedirectStandardError "$job\err.log"
"EXIT $($p.ExitCode) $(Get-Date -Format o)" | Out-File "$job\done.txt" -Encoding utf8
