@echo off
color 0B
title La More Eventos - Inicializacao
echo ===================================================
echo    Iniciando LA MORE EVENTOS
echo ===================================================
echo.

echo [1/4] Verificando e instalando bibliotecas necessarias...
call npm install exceljs file-saver jspdf jspdf-autotable recharts date-fns
if %errorlevel% neq 0 (
    color 0C
    echo Erro ao instalar dependencias! Verifique sua conexao ou o npm.
    pause
    exit /b
)

echo [2/4] Criando atalhos de acesso...
if not exist "Links de Acesso" mkdir "Links de Acesso"
echo [InternetShortcut] > "Links de Acesso\Portal Principal.url"
echo URL=http://localhost:3001/acessos >> "Links de Acesso\Portal Principal.url"
echo [InternetShortcut] > "Links de Acesso\Painel Master.url"
echo URL=http://localhost:3001/master >> "Links de Acesso\Painel Master.url"
echo [InternetShortcut] > "Links de Acesso\Retaguarda Organizador.url"
echo URL=http://localhost:3001/org >> "Links de Acesso\Retaguarda Organizador.url"
echo [InternetShortcut] > "Links de Acesso\Caixa POS.url"
echo URL=http://localhost:3001/pos >> "Links de Acesso\Caixa POS.url"
echo [InternetShortcut] > "Links de Acesso\Operador de Bar.url"
echo URL=http://localhost:3001/bar >> "Links de Acesso\Operador de Bar.url"

echo [3/4] Limpando cache do Next.js para evitar erros antigos...
if exist .next rmdir /s /q .next

echo [4/4] Iniciando o servidor...
echo.
echo ===================================================
echo  Links criados na pasta "Links de Acesso"!
echo ===================================================
echo.

:: Forca a porta 3001 para nao conflitar com a Bilheteria
call npm run dev -- -p 3001

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo O servidor encontrou um erro e parou!
    pause
)
