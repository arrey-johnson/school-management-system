$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$null = [Console]::In.ReadToEnd()

$status = git status --porcelain 2>$null
if (-not $status) {
  Write-Output "{}"
  exit 0
}

$msg = @"
Uncommitted changes remain. If this turn finished the work successfully, commit (skip secrets and database files; no --no-verify) and run git push -u origin HEAD. If the task failed or is still in progress, do not commit.
"@

$escaped = $msg.Replace("\", "\\").Replace('"', '\"').Replace("`r", "").Replace("`n", " ")
Write-Output "{ `"followup_message`": `"$escaped`" }"
exit 0
