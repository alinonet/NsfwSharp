@echo off
setlocal

pushd "%~dp0.." || exit /b 1
dotnet restore "NsfwSharp.sln" && dotnet build "NsfwSharp.sln" --no-restore
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
