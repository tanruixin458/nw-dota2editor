@echo off
cd /d %~dp0

rem 生成版本
set dt=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
echo %dt%>_VERSION

rem 打包
md build\%dt%\res
copy /y res\items_game.json build\%dt%\res\items_game.json
copy /y res\vsnd_to_soundname_v2.txt build\%dt%\res\vsnd_to_soundname_v2.txt
xcopy bin build\%dt%\bin /y /e /d /i
copy /y exe\Dota2KVEditor.exe build\%dt%\Dota2KVEditor.exe
7za a -tzip dota2editor.nw index.html package.json public partials srv icon
move /y _VERSION build\%dt%\_VERSION
move /y dota2editor.nw build\%dt%\dota2editor.nw

echo build success!
pause