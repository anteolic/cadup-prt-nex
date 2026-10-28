@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
    echo Greska: Git nije instaliran ili nije dostupan u PATH-u.
    goto failure
)

git symbolic-ref --quiet --short HEAD >nul 2>&1
if errorlevel 1 goto failure
for /f "delims=" %%B in ('git branch --show-current') do set "publish_branch=%%B"
if not "%publish_branch%"=="main" (
    echo Greska: objava ocekuje granu main. Trenutna grana: %publish_branch%
    goto failure
)

echo Spremam sve izmjene projekta...
git add --all
if errorlevel 1 goto failure

git diff --cached --quiet
if errorlevel 2 goto failure
if errorlevel 1 (
    git commit -m "Dorade aplikacije"
    if errorlevel 1 goto failure
) else (
    echo Nema novih izmjena za commit.
)

echo Saljem na GitHub...
git push origin main
if errorlevel 1 goto failure

echo.
echo Uspjesno poslano na GitHub. GitHub Pages objava moze potrajati nekoliko minuta.
echo https://anteolic.github.io/cadup-prt-nex/
pause
exit /b 0

:failure
echo.
echo Objava nije uspjela. Provjeri poruku greske iznad.
pause
exit /b 1
