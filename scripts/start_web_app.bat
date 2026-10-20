@echo off
setlocal

pushd "%~dp0..\NsfwSharp.WebExample" || exit /b 1
dotnet run --project "NsfwSharp.WebExample.csproj"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
