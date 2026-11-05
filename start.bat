@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo     TrainingHub Enterprise Dashboard Launcher
echo ===================================================
echo.

:: 1. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please download and install Node.js (v18 or v20 or v22) from https://nodejs.org/
    echo After installing, reopen this script.
    echo.
    pause
    exit /b 1
)

echo [✓] Node.js detected:
node -v
echo.

:: 2. Check for .env file
if not exist ".env" (
    echo [*] No .env file found. Creating from .env.example...
    copy ".env.example" ".env" >nul
    echo [✓] .env file initialized.
) else (
    echo [✓] Existing .env file found.
)
echo.

:: 3. Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [*] Installing project dependencies (npm install)...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
    echo [✓] Dependencies installed successfully.
) else (
    echo [✓] Dependencies already installed in node_modules.
)
echo.

:: 4. Information summary
echo ===================================================
echo   TrainingHub Dashboard Ready to Run!
echo   -------------------------------------------------
echo   Local URL:    http://localhost:3000
echo   Demo Login:   admin / Admin@123
echo   Mode:         Zero-setup Demo (In-Memory) or MySQL
echo   To Stop:      Press Ctrl + C in this terminal window
echo ===================================================
echo.

:: 5. Open browser automatically after 2 seconds
start "" http://localhost:3000

:: 6. Launch development server
echo [*] Starting server on port 3000...
call npm run dev

pause
