@echo off
title GreenWave 3D - GitHub Push
color 0B
echo =======================================================
echo   GREENWAVE 3D: PUSHING EVERYTHING TO GITHUB
echo   Repository: https://github.com/suneetbafna83-ship-it/greenwave-
echo =======================================================
echo.
echo [1/3] Pushing main branch (latest 500x500 build + README + License)...
git push -u origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Push failed. If a browser pop-up appeared, please complete sign-in.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Pushing checkpoint-01 branch (original 7x7 build)...
git push origin checkpoint-01

echo.
echo [3/3] Pushing all 9 milestone tags (edit-01 to edit-09)...
git push origin --tags

echo.
echo =======================================================
echo   SUCCESS! ALL CODE, BRANCHES & TAGS ARE ON GITHUB!
echo   Visit: https://github.com/suneetbafna83-ship-it/greenwave-
echo =======================================================
echo.
pause
