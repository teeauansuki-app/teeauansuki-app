import { listWindowsPrinters } from './windows-printer.mjs';

listWindowsPrinters()
  .then((output) => {
    console.log(output || 'No Windows printers found');
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`List printers failed: ${message}`);
    process.exit(1);
  });
