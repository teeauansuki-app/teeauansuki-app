import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printTextWithWindowsDriver } from './windows-printer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const DEFAULT_CONFIG = {
  printerName: 'POS-80C',
  restaurantName: 'ตี๋อ้วน สุกี้ชาบู',
  pollIntervalMs: 3000,
  batchSize: 1,
  printMode: 'windows-driver',
};

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

function getConfig() {
  const rootEnv = loadDotEnvFile(join(projectRoot, '.env.local'));
  const localEnv = loadDotEnvFile(join(__dirname, '.env'));
  const jsonConfig = loadJsonConfig(join(__dirname, 'config.json'));
  const env = { ...rootEnv, ...localEnv, ...process.env };

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    env.PRINT_AGENT_SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY;

  return {
    ...DEFAULT_CONFIG,
    ...jsonConfig,
    supabaseUrl,
    supabaseKey,
    printerName: env.KITCHEN_PRINTER_NAME || jsonConfig.printerName || DEFAULT_CONFIG.printerName,
    restaurantName: env.KITCHEN_RESTAURANT_NAME || jsonConfig.restaurantName || DEFAULT_CONFIG.restaurantName,
    pollIntervalMs: Number(env.KITCHEN_PRINT_POLL_MS || jsonConfig.pollIntervalMs || DEFAULT_CONFIG.pollIntervalMs),
    batchSize: Number(env.KITCHEN_PRINT_BATCH_SIZE || jsonConfig.batchSize || DEFAULT_CONFIG.batchSize),
  };
}

function assertConfig(config) {
  if (!config.supabaseUrl || !config.supabaseUrl.startsWith('http')) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!config.supabaseKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or PRINT_AGENT_SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!config.printerName) {
    throw new Error('Missing printer name');
  }
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function selectedOptionsText(options = []) {
  if (!Array.isArray(options)) return '';

  return options
    .map((option) => {
      const groupName = String(option?.group_name || '').trim();
      const choiceNames = Array.isArray(option?.choice_names)
        ? option.choice_names.map((name) => String(name || '').trim()).filter(Boolean)
        : [];

      if (!groupName || choiceNames.length === 0) return '';
      return `${groupName}: ${choiceNames.join(', ')}`;
    })
    .filter(Boolean)
    .join(' | ');
}

function itemReceiptTexts(job, config) {
  const order = job.orders || {};
  const session = order.sessions || {};
  const tableNumber = session.tables?.table_number || '-';
  const packageName = session.packages?.name || '-';
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  if (items.length === 0) {
    return [receiptText(job, config)];
  }

  return items.map((item, index) => {
    const name = item.menu_items?.name || `เมนู #${item.menu_item_id}`;
    const optionText = selectedOptionsText(item.selected_options);
    const notes = String(item.notes || '').trim();
    const lines = [
      `@CENTER|${config.restaurantName}`,
      '@KITCHEN|ใบสั่งเข้าครัว',
      '@LINE|',
      `@META|โต๊ะ ${tableNumber}  •  ออเดอร์ #${order.id || job.order_id}`,
      `@SMALL|${packageName}  •  คิว #${job.id}  •  รายการ ${index + 1}/${items.length}`,
      `@SMALL|${formatDateTime(job.created_at)}`,
      '@LINE|',
      `@ITEM|${name}`,
      `@QTY|จำนวน ${item.quantity}`,
    ];

    if (optionText) lines.push(`@OPT|${optionText}`);
    if (notes) lines.push(`@NOTE|โน้ต: ${notes}`);

    lines.push('@LINE|');

    return lines.join('\r\n');
  });
}

function receiptText(job, config) {
  const order = job.orders || {};
  const session = order.sessions || {};
  const tableNumber = session.tables?.table_number || '-';
  const packageName = session.packages?.name || '-';
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const line = '-'.repeat(32);

  const lines = [
    config.restaurantName,
    'ใบสั่งอาหารเข้าครัว',
    line,
    `โต๊ะ: ${tableNumber}`,
    `แพ็กเกจ: ${packageName}`,
    `ออเดอร์: #${order.id || job.order_id}`,
    `คิวพิมพ์: #${job.id}`,
    `เวลา: ${formatDateTime(job.created_at)}`,
    line,
  ];

  if (items.length === 0) {
    lines.push('ไม่มีรายการอาหาร');
  }

  for (const [index, item] of items.entries()) {
    const name = item.menu_items?.name || `เมนู #${item.menu_item_id}`;
    lines.push(`${index + 1}. ${name}`);
    lines.push(`   จำนวน: ${item.quantity}`);

    const optionText = selectedOptionsText(item.selected_options);
    if (optionText) lines.push(`   ตัวเลือก: ${optionText}`);

    const notes = String(item.notes || '').trim();
    if (notes) lines.push(`   โน้ต: ${notes}`);
  }

  lines.push(line);
  lines.push(' ');
  lines.push(' ');

  return lines.join('\r\n');
}

async function fetchPendingJobs(supabase, batchSize) {
  const { data, error } = await supabase
    .from('print_jobs')
    .select(`
      *,
      orders (
        id,
        sessions (
          tables (table_number),
          packages (name)
        ),
        order_items (
          *,
          menu_items (name)
        )
      )
    `)
    .eq('status', 'pending')
    .is('error_message', null)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error) throw error;
  return data || [];
}

async function claimPrintJob(supabase, jobId) {
  const { data, error } = await supabase
    .from('print_jobs')
    .update({
      error_message: `printing:${new Date().toISOString()}`,
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .is('error_message', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function updateJobStatus(supabase, jobId, status, errorMessage = null) {
  const { error } = await supabase
    .from('print_jobs')
    .update({
      status,
      error_message: errorMessage ? errorMessage.slice(0, 500) : null,
    })
    .eq('id', jobId);

  if (error) throw error;
}

async function main() {
  const config = getConfig();
  assertConfig(config);

  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const processing = new Set();
  let isPolling = false;

  async function processPendingJobs(reason = 'poll') {
    if (isPolling) return;
    isPolling = true;

    try {
      const jobs = await fetchPendingJobs(supabase, config.batchSize);
      if (jobs.length > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Found ${jobs.length} pending print job(s) from ${reason}`);
      }

      for (const job of jobs) {
        if (processing.has(job.id)) continue;
        processing.add(job.id);

        try {
          const claimed = await claimPrintJob(supabase, job.id);
          if (!claimed) {
            processing.delete(job.id);
            continue;
          }

          const texts = itemReceiptTexts(job, config);
          for (const text of texts) {
            await printTextWithWindowsDriver(text, config.printerName);
          }
          await updateJobStatus(supabase, job.id, 'printed');
          console.log(`Printed job #${job.id} for order #${job.order_id} (${texts.length} slip(s))`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await updateJobStatus(supabase, job.id, 'failed', message);
          console.error(`Failed job #${job.id}: ${message}`);
        } finally {
          processing.delete(job.id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Print agent polling error: ${message}`);
    } finally {
      isPolling = false;
    }
  }

  console.log('Kitchen print agent started');
  console.log(`Printer: ${config.printerName}`);
  console.log(`Poll interval: ${config.pollIntervalMs}ms`);

  const channel = supabase
    .channel('kitchen-print-agent')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'print_jobs' },
      () => processPendingJobs('realtime')
    )
    .subscribe((status) => {
      console.log(`Realtime status: ${status}`);
      if (status === 'SUBSCRIBED') {
        processPendingJobs('realtime-subscribe');
      }
    });

  processPendingJobs('startup');
  const interval = setInterval(() => processPendingJobs('interval'), config.pollIntervalMs);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    await supabase.removeChannel(channel);
    console.log('Kitchen print agent stopped');
    process.exit(0);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kitchen print agent failed to start: ${message}`);
  process.exit(1);
});
