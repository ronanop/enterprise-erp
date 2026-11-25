param(
    [string]$Deck = (Join-Path $PSScriptRoot "..\iConnect-Plus_CRM-HRMS-Employee-App.pptx"),
    [string]$OutDir = (Join-Path $PSScriptRoot "..\build\preview")
)

$deckPath = (Resolve-Path $Deck).Path
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$outPath = (Resolve-Path $OutDir).Path

$app = New-Object -ComObject PowerPoint.Application
try {
    $pres = $app.Presentations.Open($deckPath, $true, $false, $false)
    $count = $pres.Slides.Count
    foreach ($slide in $pres.Slides) {
        $file = Join-Path $outPath ("slide-{0:D2}.png" -f $slide.SlideIndex)
        $slide.Export($file, "PNG", 1600, 900)
    }
    $pres.Close()
    Write-Output "Rendered $count slides to $outPath"
}
finally {
    $app.Quit()
}
