import { spawn } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function encodePowerShellCommand(command) {
  return Buffer.from(command, 'utf16le').toString('base64');
}

function runPowerShell(command) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encodePowerShellCommand(command),
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim());
        return;
      }

      reject(new Error((stderr || stdout).trim() || `PowerShell exited with code ${code}`));
    });
  });
}

function joinPowerShellLines(lines) {
  return lines.join('\r\n');
}

export async function listWindowsPrinters() {
  const command = joinPowerShellLines([
    "$ErrorActionPreference = 'Stop';",
    "Add-Type -AssemblyName System.Drawing;",
    "[System.Drawing.Printing.PrinterSettings]::InstalledPrinters |",
    'ForEach-Object { $_ } |',
    'Out-String -Width 240',
  ]);

  return runPowerShell(command);
}

export async function printTextWithWindowsDriver(text, printerName) {
  const tempDir = join(tmpdir(), 'tee-uan-kitchen-print-agent');
  mkdirSync(tempDir, { recursive: true });

  const tempPath = join(tempDir, `receipt-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  writeFileSync(tempPath, `\ufeff${text}`, 'utf8');

  const command = joinPowerShellLines([
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Drawing",
    `$path = ${JSON.stringify(tempPath)}`,
    `$printer = ${JSON.stringify(printerName)}`,
    "$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)",
    "$doc = New-Object System.Drawing.Printing.PrintDocument",
    "$doc.PrinterSettings.PrinterName = $printer",
    "if (-not $doc.PrinterSettings.IsValid) {",
    "  $available = ([System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object { $_ }) -join ', '",
    "  throw \"Printer '$printer' is not valid for this Windows user. Available printers: $available\"",
    "}",
    "$doc.DocumentName = 'Tee Uan Kitchen Order'",
    "$doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('KitchenSlip80', 300, 360)",
    "$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(5, 5, 5, 5)",
    "$fontRegular = New-Object System.Drawing.Font('Tahoma', 10, [System.Drawing.FontStyle]::Regular)",
    "$fontSmall = New-Object System.Drawing.Font('Tahoma', 9, [System.Drawing.FontStyle]::Regular)",
    "$fontBold = New-Object System.Drawing.Font('Tahoma', 11, [System.Drawing.FontStyle]::Bold)",
    "$fontTitle = New-Object System.Drawing.Font('Tahoma', 12, [System.Drawing.FontStyle]::Bold)",
    "$fontItem = New-Object System.Drawing.Font('Tahoma', 18, [System.Drawing.FontStyle]::Bold)",
    "$fontQty = New-Object System.Drawing.Font('Tahoma', 20, [System.Drawing.FontStyle]::Bold)",
    "$brush = [System.Drawing.Brushes]::Black",
    "$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)",
    "$doc.add_PrintPage({",
    "  param($sender, $eventArgs)",
    "  $graphics = $eventArgs.Graphics",
    "  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit",
    "  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None",
    "  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed",
    "  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor",
    "  $left = 2",
    "  $top = 2",
    "  $width = [Single]([Math]::Max(120, $eventArgs.PageBounds.Width - 4))",
    "  $y = [Single]$top",
    "  $lines = $text -split \"`r?`n\"",
    "  foreach ($rawLine in $lines) {",
    "    if ([String]::IsNullOrWhiteSpace($rawLine)) { continue }",
    "    $line = [String]$rawLine",
    "    $font = $fontRegular",
    "    $align = [System.Drawing.StringAlignment]::Near",
    "    $gap = 2",
    "    $heavyInk = $false",
    "    if ($line.StartsWith('@LINE|')) {",
    "      $graphics.DrawLine($pen, $left, $y + 4, $left + $width, $y + 4)",
    "      $y += 11",
    "      continue",
    "    } elseif ($line.StartsWith('@CENTER|')) {",
    "      $line = $line.Substring(8)",
    "      $font = $fontTitle",
    "      $align = [System.Drawing.StringAlignment]::Center",
    "      $heavyInk = $true",
    "      $gap = 0",
    "    } elseif ($line.StartsWith('@KITCHEN|')) {",
    "      $line = $line.Substring(9)",
    "      $font = $fontBold",
    "      $align = [System.Drawing.StringAlignment]::Center",
    "      $heavyInk = $true",
    "      $gap = 3",
    "    } elseif ($line.StartsWith('@META|')) {",
    "      $line = $line.Substring(6)",
    "      $font = $fontBold",
    "      $heavyInk = $true",
    "      $gap = 2",
    "    } elseif ($line.StartsWith('@SMALL|')) {",
    "      $line = $line.Substring(7)",
    "      $font = $fontSmall",
    "      $gap = 1",
    "    } elseif ($line.StartsWith('@ITEM|')) {",
    "      $line = $line.Substring(6)",
    "      $font = $fontItem",
    "      $heavyInk = $true",
    "      $gap = 4",
    "    } elseif ($line.StartsWith('@QTY|')) {",
    "      $line = $line.Substring(5)",
    "      $font = $fontQty",
    "      $align = [System.Drawing.StringAlignment]::Center",
    "      $heavyInk = $true",
    "      $gap = 4",
    "    } elseif ($line.StartsWith('@OPT|')) {",
    "      $line = $line.Substring(5)",
    "      $font = $fontBold",
    "      $heavyInk = $true",
    "      $gap = 2",
    "    } elseif ($line.StartsWith('@NOTE|')) {",
    "      $line = $line.Substring(6)",
    "      $font = $fontBold",
    "      $heavyInk = $true",
    "      $gap = 2",
    "    }",
    "    $format = New-Object System.Drawing.StringFormat",
    "    $format.Alignment = $align",
    "    $format.LineAlignment = [System.Drawing.StringAlignment]::Near",
    "    $format.Trimming = [System.Drawing.StringTrimming]::Word",
    "    $measure = $graphics.MeasureString($line, $font, [Int32]$width)",
    "    $height = [Single]([Math]::Ceiling($measure.Height) + 2)",
    "    $rect = New-Object System.Drawing.RectangleF([Single]$left, [Single]$y, [Single]$width, $height)",
    "    $graphics.DrawString($line, $font, $brush, $rect, $format)",
    "    if ($heavyInk) {",
    "      $rectHeavy = New-Object System.Drawing.RectangleF([Single]($left + 0.45), [Single]$y, [Single]$width, $height)",
    "      $graphics.DrawString($line, $font, $brush, $rectHeavy, $format)",
    "    }",
    "    $format.Dispose()",
    "    $y += $height + $gap",
    "  }",
    "  $eventArgs.HasMorePages = $false",
    "})",
    'try {',
    "  $doc.Print()",
    '} finally {',
    "  $fontRegular.Dispose()",
    "  $fontSmall.Dispose()",
    "  $fontBold.Dispose()",
    "  $fontTitle.Dispose()",
    "  $fontItem.Dispose()",
    "  $fontQty.Dispose()",
    "  $pen.Dispose()",
    "  $doc.Dispose()",
    '}',
  ]);

  try {
    await runPowerShell(command);
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // Temp cleanup is best-effort only.
    }
  }
}
