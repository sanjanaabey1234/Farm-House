// Writes the blank Excel accounting workbook (deliverable 1). Run: npm run template

import ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildWorkbookBuffer, exportFileName } from '../lib/excel';

(async () => {
  const buf = await buildWorkbookBuffer(ExcelJS, { business: null });
  mkdirSync('out', { recursive: true });
  const file = `out/${exportFileName(null)}`;
  writeFileSync(file, Buffer.from(buf));
  console.log(`Wrote ${file}`);
})();
