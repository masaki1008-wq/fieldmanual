@echo off
chcp 65001 > nul
setlocal

echo.
echo ========================================
echo   FieldManual セットアップ (Windows)
echo ========================================

:: Node.js チェック
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Node.js が見つかりません。
    echo         https://nodejs.org からインストールしてください。
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.version)"') do set NODE_VER=%%v
echo   OK Node.js %NODE_VER% を検出

:: 証明書チェック
if exist cert.pem (
    if exist key.pem (
        echo   OK SSL証明書は既に存在します ^(スキップ^)
        goto :start_server
    )
)

:: openssl チェック
where openssl >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo   [INFO] openssl が見つかりません。
    echo          Git for Windows や WSL に付属の openssl を使用するか、
    echo          https://slproweb.com/products/Win32OpenSSL.html からインストールしてください。
    echo.
    echo          または、Mac/Linux 環境で start.sh を実行してください。
    pause
    exit /b 1
)

echo   生成中: SSL証明書...
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 825 -nodes ^
  -subj "/C=JP/ST=Tokyo/O=FieldManual/CN=localhost" ^
  -addext "subjectAltName=IP:127.0.0.1,IP:0.0.0.0,DNS:localhost" 2>nul
echo   OK SSL証明書を生成しました

:start_server
echo.
echo   起動中: HTTPSサーバー...
echo.
node server.js 8443
pause
