import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const bundledPdfJsPath = path.join(
  os.homedir(),
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'node',
  'node_modules',
  'pdfjs-dist',
  'legacy',
  'build',
  'pdf.mjs',
);

const knownCodes = new Set([
  19,
  21,
  22,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  51,
  52,
  54,
  55,
  60,
  61,
  62,
  65,
  66,
  67,
  68,
  69,
]);

let pdfJsPromise;

function cleanNumber(value) {
  const digits = String(value).replaceAll(/\D/g, '');

  if (!digits) {
    return null;
  }

  return Number(digits);
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(pathToFileURL(bundledPdfJsPath).href);
  }

  return await pdfJsPromise;
}

function buildLines(items) {
  const lines = [];
  let currentLine = null;

  for (const item of items) {
    if (!('str' in item)) {
      continue;
    }

    const text = String(item.str).trim();

    if (!text) {
      continue;
    }

    const y = typeof item.transform?.[5] === 'number' ? item.transform[5] : 0;

    if (!currentLine || Math.abs(currentLine.y - y) > 2) {
      currentLine = {
        parts: [],
        y,
      };
      lines.push(currentLine);
    }

    currentLine.parts.push(text);

    if (item.hasEOL) {
      currentLine = null;
    }
  }

  return lines
    .map(line => line.parts.join(' ').replaceAll(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export async function parsePlanningPdfPageOne(pdfBuffer) {
  const pdfjs = await loadPdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  });

  const pdfDocument = await loadingTask.promise;
  const firstPage = await pdfDocument.getPage(1);
  const textContent = await firstPage.getTextContent();
  const lines = buildLines(textContent.items);
  const pageText = lines.join('\n');
  const dateMatch = pageText.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/);
  const documentDate = dateMatch?.[1] ?? null;
  const startIndex = lines.findIndex(line => /^\d+$/.test(line) && knownCodes.has(Number(line)));

  if (startIndex < 0) {
    throw new Error('Geen artikelcodes gevonden op pagina 1.');
  }

  const codes = [];
  let cursor = startIndex;

  while (cursor < lines.length) {
    const line = lines[cursor];

    if (!/^\d+$/.test(line)) {
      break;
    }

    const code = Number(line);

    if (!knownCodes.has(code)) {
      break;
    }

    codes.push(code);
    cursor += 1;
  }

  const descriptions = [];

  while (cursor < lines.length && descriptions.length < codes.length) {
    descriptions.push(lines[cursor]);
    cursor += 1;
  }

  const quantities = [];

  while (cursor < lines.length && quantities.length < codes.length) {
    const quantity = cleanNumber(lines[cursor]);

    if (quantity === null) {
      cursor += 1;

      continue;
    }

    quantities.push(quantity);
    cursor += 1;
  }

  if (descriptions.length !== codes.length || quantities.length !== codes.length) {
    throw new Error('Kon codes, omschrijvingen en aantallen niet betrouwbaar uitlijnen.');
  }

  const groups = codes.map((code, index) => ({
    code,
    description: descriptions[index],
    colli: quantities[index],
  }));

  return {
    documentDate,
    groups,
  };
}
