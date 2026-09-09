$ErrorActionPreference = 'Stop'
$voiceWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$voiceDirectory = Join-Path $voiceWorkspace 'work/livekit'
$voiceVersion = '1.13.6'
$voiceArchitecture = if ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'arm64' } else { 'amd64' }
$voiceArchiveName = "livekit_${voiceVersion}_windows_${voiceArchitecture}.zip"
$voiceRelease = "https://github.com/livekit/livekit/releases/download/v$voiceVersion"
New-Item -ItemType Directory -Path $voiceDirectory -Force | Out-Null
Invoke-WebRequest -Uri "$voiceRelease/checksums.txt" -OutFile (Join-Path $voiceDirectory 'checksums.txt')
Invoke-WebRequest -Uri "$voiceRelease/$voiceArchiveName" -OutFile (Join-Path $voiceDirectory $voiceArchiveName)
$voiceExpected = ((Get-Content (Join-Path $voiceDirectory 'checksums.txt') | Where-Object { $_.EndsWith($voiceArchiveName) }) -split '\s+')[0]
if ((Get-FileHash (Join-Path $voiceDirectory $voiceArchiveName) -Algorithm SHA256).Hash -ne $voiceExpected) { throw 'LiveKit checksum mismatch. Nothing was executed.' }
Expand-Archive -LiteralPath (Join-Path $voiceDirectory $voiceArchiveName) -DestinationPath $voiceDirectory -Force
& (Join-Path $voiceDirectory 'livekit-server.exe') --version
Write-Output 'Local Voice is prepared. Start game and voice together with npm run dev:voice.'
