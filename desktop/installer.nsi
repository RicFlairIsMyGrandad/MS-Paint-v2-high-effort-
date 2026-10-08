; PaintPlus per-user Windows installer. The uninstaller is generated on the
; Windows machine at install time, so cross compilation does not need Wine.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

Name "PaintPlus"
InstallDir "$LOCALAPPDATA\Programs\PaintPlus"
InstallDirRegKey HKCU "Software\PaintPlus" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
BrandingText "PaintPlus — your canvas, your computer"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\PaintPlus.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch PaintPlus"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "PaintPlus requires Windows 10 or Windows 11."
    Abort
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "PaintPlus requires 64-bit Windows 10 or Windows 11."
    Abort
  ${EndIf}
FunctionEnd

Section "PaintPlus" SEC_MAIN
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  !ifdef NSIS_WIN32_MAKENSIS
    File /r "${PROJECT_DIR}\release\win-unpacked\*"
  !else
    File /r "${PROJECT_DIR}/release/win-unpacked/*"
  !endif
  WriteUninstaller "$INSTDIR\Uninstall PaintPlus.exe"
  CreateDirectory "$SMPROGRAMS\PaintPlus"
  CreateShortcut "$SMPROGRAMS\PaintPlus\PaintPlus.lnk" "$INSTDIR\PaintPlus.exe" "" "$INSTDIR\resources\icon.ico"
  CreateShortcut "$SMPROGRAMS\PaintPlus\Uninstall PaintPlus.lnk" "$INSTDIR\Uninstall PaintPlus.exe"
  CreateShortcut "$DESKTOP\PaintPlus.lnk" "$INSTDIR\PaintPlus.exe" "" "$INSTDIR\resources\icon.ico"
  WriteRegStr HKCU "Software\PaintPlus" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "DisplayName" "PaintPlus"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "DisplayIcon" "$INSTDIR\resources\icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "Publisher" "PaintPlus contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "UninstallString" '$\"$INSTDIR\Uninstall PaintPlus.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "QuietUninstallString" '$\"$INSTDIR\Uninstall PaintPlus.exe$\" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus" "EstimatedSize" ${APP_64_UNPACKED_SIZE}
  WriteRegStr HKCU "Software\Classes\.paintplus" "" "PaintPlus.Project"
  WriteRegStr HKCU "Software\Classes\PaintPlus.Project" "" "PaintPlus editable project"
  WriteRegStr HKCU "Software\Classes\PaintPlus.Project\DefaultIcon" "" "$INSTDIR\resources\icon.ico"
  WriteRegStr HKCU "Software\Classes\PaintPlus.Project\shell\open\command" "" '$\"$INSTDIR\PaintPlus.exe$\" $\"%1$\"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ; Delete only shipped files. User-added projects and images are retained.
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\PaintPlus.exe"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\version"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\locales\*.pak"
  RMDir "$INSTDIR\locales"
  Delete "$INSTDIR\resources\app.asar"
  Delete "$INSTDIR\resources\icon.ico"
  Delete "$INSTDIR\resources\icon.png"
  RMDir "$INSTDIR\resources"
  Delete "$INSTDIR\Uninstall PaintPlus.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\PaintPlus.lnk"
  Delete "$SMPROGRAMS\PaintPlus\PaintPlus.lnk"
  Delete "$SMPROGRAMS\PaintPlus\Uninstall PaintPlus.lnk"
  RMDir "$SMPROGRAMS\PaintPlus"
  DeleteRegKey HKCU "Software\PaintPlus"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaintPlus"
  ReadRegStr $0 HKCU "Software\Classes\.paintplus" ""
  ${If} $0 == "PaintPlus.Project"
    DeleteRegKey HKCU "Software\Classes\.paintplus"
  ${EndIf}
  DeleteRegKey HKCU "Software\Classes\PaintPlus.Project"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ; %APPDATA% settings, indexed assets and saved image files are not deleted.
SectionEnd
