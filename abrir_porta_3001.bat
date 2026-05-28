@echo off
echo ==========================================
echo  ABRINDO PORTA 3001 NO FIREWALL
echo ==========================================
echo.

netsh advfirewall firewall add rule name="LaMore Eventos - Porta 3001" dir=in action=allow protocol=TCP localport=3001

if %errorlevel%==0 (
    echo.
    echo [OK] Porta 3001 liberada com sucesso!
    echo.
    echo Agora acesse no celular:
    echo http://192.168.0.61:3001
) else (
    echo.
    echo [ERRO] Nao foi possivel criar a regra.
    echo Execute este arquivo como Administrador!
)

echo.
pause
