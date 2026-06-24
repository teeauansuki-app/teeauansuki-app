import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printTextWithWindowsDriver } from './windows-printer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const result = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadJsonConfig(filePath) {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

const rootEnv = loadDotEnvFile(join(projectRoot, '.env.local'));
const localEnv = loadDotEnvFile(join(__dirname, '.env'));
const jsonConfig = loadJsonConfig(join(__dirname, 'config.json'));
const env = { ...rootEnv, ...localEnv, ...process.env };
const printerName = env.KITCHEN_PRINTER_NAME || jsonConfig.printerName || 'POS-80C';

const text = [
  'ตี๋อ้วน สุกี้ชาบู',
  'ทดสอบเครื่องพิมพ์ครัว',
  '------------------------------',
  `Printer: ${printerName}`,
  `เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
  'ถ้าเห็นใบนี้ แปลว่า agent ส่งงานไป printer ได้',
  ' ',
  ' ',
].join('\r\n');

printTextWithWindowsDriver(text, printerName)
  .then(() => {
    console.log(`Test print sent to "${printerName}"`);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Test print failed: ${message}`);
    process.exit(1);
  });
