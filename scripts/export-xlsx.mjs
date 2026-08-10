import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Sheets follow spec 21.3. Taxonomy is JSON, so it is flattened to key/value
// rows; the rest are the master CSVs and the researched validation summary.
const csvSheets = [
  ['Dishes', 'data/master/dishes.csv'],
  ['Taste Scores', 'data/master/taste-scores.csv'],
  ['Relations', 'data/master/relations.csv'],
  ['Sources', 'data/master/sources.csv'],
  ['Tags', 'data/standard-styles/dish-tags.csv'],
  ['Validation Summary', 'data/standard-styles/validation-summary.csv']
];

const workbook = XLSX.utils.book_new();
for (const [sheetName, relativePath] of csvSheets) {
  const csv = fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^﻿/, '');
  const workbookPart = XLSX.read(csv, { type: 'string' });
  XLSX.utils.book_append_sheet(workbook, workbookPart.Sheets[workbookPart.SheetNames[0]], sheetName);
}

const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'data/master/taxonomy.json'), 'utf8'));
const taxonomyRows = [['group', 'key', 'value']];
for (const [group, value] of Object.entries(taxonomy)) {
  if (Array.isArray(value)) for (const [index, item] of value.entries()) taxonomyRows.push([group, String(index + 1), item]);
  else for (const [key, label] of Object.entries(value)) taxonomyRows.push([group, key, label]);
}
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(taxonomyRows), 'Taxonomy');

const output = path.join(root, 'data/ramen-master.xlsx');
XLSX.writeFile(workbook, output);
console.log(`Wrote ${output} (${workbook.SheetNames.length} sheets)`);
