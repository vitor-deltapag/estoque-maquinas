$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Ficheiros de teste ==="
Write-Host "  tests/test_public.py       - GET / publico; 401 sem token"
Write-Host "  tests/test_auth.py        - POST /login 401/200/429/500"
Write-Host "  tests/test_deps.py        - JWT HS256/ES256, inativo, auto-create"
Write-Host "  tests/test_cadastros.py   - CRUD adquirentes, clientes, fornecedores"
Write-Host "  tests/test_dispositivos.py - listagem, dashboard, regras de MID/serial, lote"
Write-Host "  tests/test_eventos.py     - lote, pendencia e finalizar evento"
Write-Host "  tests/test_parceiros.py   - CRUD parceiro, seriais so leitura, delete com maquina"
Write-Host "  tests/test_usuarios.py    - /me, admin, criar/editar/apagar"
Write-Host "  tests/test_helpers.py     - empty_to_none"
Write-Host "  tests/test_database.py    - get_db fecha a sessao"
Write-Host ""

Write-Host "=== pytest (-v + cobertura >= 85%) ==="
& .\.venv\Scripts\python.exe -m pytest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== bandit (ficheiros analisados) ==="
& .\.venv\Scripts\python.exe -m bandit -r . -c .bandit.yml -v
exit $LASTEXITCODE
