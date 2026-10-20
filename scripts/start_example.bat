@echo off
setlocal

pushd "%~dp0..\NsfwSharp.Example" || exit /b 1
if not exist "yolo_11m_nsfw.onnx" (
    echo Missing required file: yolo_11m_nsfw.onnx
    echo Place the model in the NsfwSharp.Example folder.
    popd
    exit /b 1
)
if not exist "test.jpg" (
    echo Missing required file: test.jpg
    echo Place the input image in the NsfwSharp.Example folder.
    popd
    exit /b 1
)

dotnet run --project "NsfwSharp.Example.csproj"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
