param(
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
$expectedPage = [System.IO.File]::ReadAllText((Join-Path $siteRoot 'index.html'))
$previewUrl = $null

function Test-PreviewSite([string]$Address) {
    try {
        $response = Invoke-WebRequest -Uri ($Address + '/index.html') -UseBasicParsing -TimeoutSec 2
        $pageText = [System.Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
        return $pageText -ceq $expectedPage
    } catch {
        return $false
    }
}

foreach ($candidatePort in $Port..($Port + 9)) {
    $address = 'http://127.0.0.1:' + $candidatePort
    if (Test-PreviewSite $address) {
        $previewUrl = $address
        break
    }

    # Do not interfere with another service using the requested port.
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
    try {
        $listener.Start()
    } catch {
        continue
    } finally {
        $listener.Stop()
    }

    $pythonCommand = Get-Command python -ErrorAction Stop
    $serverOptions = @{
        FilePath = $pythonCommand.Source
        ArgumentList = @('-m', 'http.server', $candidatePort, '--bind', '127.0.0.1')
        WorkingDirectory = $siteRoot
        WindowStyle = 'Hidden'
        PassThru = $true
    }
    $serverProcess = Start-Process @serverOptions

    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (Test-PreviewSite $address) {
            $previewUrl = $address
            break
        }
        if ($serverProcess.HasExited) { break }
        Start-Sleep -Milliseconds 150
    }
    if ($previewUrl) { break }
    if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id }
}

if (-not $previewUrl) {
    throw 'Could not start the local preview. Confirm that Python is installed and a port from 8000 to 8009 is available.'
}

$pageUrl = $previewUrl + '/#inventory'
Write-Output ('FireNav preview: ' + $pageUrl)
if (-not $NoBrowser) { Start-Process $pageUrl }
