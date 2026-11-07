#define MyAppName "Promptstack School Management"
#define MyAppVersion "0.8.0"
#define MyAppPublisher "Promptstack Technologies"

[Setup]
AppId={{8F3C2A11-6B4E-4D8A-9C21-PROMPTSTACKSMS}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\PromptstackSMS
DefaultGroupName=Promptstack SMS
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=PromptstackSMS-Setup-0.8.0
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "Install-PromptstackSMS.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Start-PromptstackSMS.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Upgrade-PromptstackSMS.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Uninstall-PromptstackSMS.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "compose\*"; DestDir: "{app}\compose"; Flags: ignoreversion recursesubdirs
Source: "payload\promptstack-sms-image.tar"; DestDir: "{app}\payload"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autodesktop}\Open School System"; Filename: "http://localhost:3847"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Install-PromptstackSMS.ps1"" -InstallDir ""{app}"""; Description: "Load Docker image, firewall, boot task"; Flags: runhidden waituntilterminated
