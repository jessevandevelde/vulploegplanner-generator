import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';
import { parsePlanningPdfPageOne } from './planning-pdf-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDirectory = path.resolve(__dirname, '../src/json');
const port = Number(process.env.PORT) || 3101;

const dayFiles = {
  maandag: 'maandag-personeel.json',
  dinsdag: 'dinsdag-personeel.json',
  woensdag: 'woensdag-personeel.json',
  donderdag: 'donderdag-personeel.json',
  vrijdag: 'vrijdag-personeel.json',
  zaterdag: 'zaderdag-personeel.json',
  zondag: 'zondag-personeel.json',
};

const dayLabels = {
  maandag: 'Maandag',
  dinsdag: 'Dinsdag',
  woensdag: 'Woensdag',
  donderdag: 'Donderdag',
  vrijdag: 'Vrijdag',
  zaterdag: 'Zaterdag',
  zondag: 'Zondag',
};

const planningPads = [
  { name: 'Frisdrank', codes: [55] },
  { name: 'Bieren', codes: [54] },
  { name: 'Vruchtensappen', codes: [51] },
  { name: 'Houdbare melk', codes: [22, 31] },
  { name: 'Suikerwerk / chocolade', codes: [34, 35] },
  { name: 'Geelvetten', codes: [21] },
  { name: 'Reinigingsmiddelen / huishoudelijk', codes: [66, 67, 68] },
  { name: 'Dierenvoeding', codes: [49] },
  { name: 'Wasmiddelen / cosmetica', codes: [65, 60] },
  { name: 'Papierwaren / luiers / kindervoeding', codes: [61, 62, 45] },
  { name: 'Chips / noten / non-food', codes: [44, 69] },
  { name: 'Wijnen', codes: [52] },
  { name: 'Koek', codes: [33] },
  { name: 'Bakproducten / koffie / thee / suiker', codes: [30, 32, 48] },
  { name: 'Zuren sauzen / soepen', codes: [39, 40] },
  { name: 'Oosters / rijst / vis / vleesconserven', codes: [43] },
  { name: 'Texmex / mixen / pasta / pesto', codes: [37, 38] },
  { name: 'Potgroente / zonnatura', codes: [41] },
  { name: 'Kellog\'s / afbakbrood / ontbijtkoek', codes: [47] },
  { name: 'Boterhambeleg', codes: [36] },
  { name: 'Eieren / vruchtenconserven / smaak', codes: [19, 42] },
];

const dayNames = Object.keys(dayFiles);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  response.end(JSON.stringify(body));
}

function sendExcelFile(response, fileName, fileContents) {
  response.writeHead(200, {
    'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  response.end(fileContents);
}

function isValidDay(day) {
  return dayNames.includes(day);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;');
}

function normalizeDescription(value) {
  return String(value).trim();
}

function detectDayFromFileName(fileName) {
  const normalizedFileName = fileName.toLowerCase();

  return dayNames.find(day => normalizedFileName.includes(day)) ?? null;
}

function detectDayFromDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const [dayString, monthString, yearString] = dateValue.split('/');
  const day = Number(dayString);
  const month = Number(monthString);
  const year = Number(yearString);

  if (!day || !month || !year) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  return [
    'zondag',
    'maandag',
    'dinsdag',
    'woensdag',
    'donderdag',
    'vrijdag',
    'zaterdag',
  ][weekday] ?? null;
}

function detectPlanningDay(fileName, documentDate) {
  const dayFromFileName = detectDayFromFileName(fileName);

  if (dayFromFileName) {
    return dayFromFileName;
  }

  return detectDayFromDate(documentDate) ?? 'maandag';
}

function formatDocumentDate(dateValue) {
  if (!dateValue) {
    return '';
  }

  const [dayString, monthString, yearString] = dateValue.split('/');
  const day = Number(dayString);
  const month = Number(monthString);
  const year = Number(yearString);

  if (!day || !month || !year) {
    return dateValue;
  }

  const formatter = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readRequestBody(request) {
  let rawBody = '';

  for await (const chunk of request) {
    rawBody += chunk;
  }

  return rawBody;
}

async function readJsonBody(request) {
  const rawBody = await readRequestBody(request);

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

async function readDayFile(day) {
  const filePath = path.join(jsonDirectory, dayFiles[day]);

  try {
    const rawContent = await readFile(filePath, 'utf8');

    if (!rawContent.trim()) {
      return [];
    }

    const parsedContent = JSON.parse(rawContent);

    if (!Array.isArray(parsedContent)) {
      return [];
    }

    return parsedContent
      .filter(entry => typeof entry === 'string')
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }
  catch {
    return [];
  }
}

async function writeDayFile(day, names) {
  const filePath = path.join(jsonDirectory, dayFiles[day]);

  const sanitizedNames = names
    .filter(entry => typeof entry === 'string')
    .map(name => name.trim())
    .filter(name => name.length > 0);

  await writeFile(filePath, `${JSON.stringify(sanitizedNames, null, 2)}\n`, 'utf8');

  return sanitizedNames;
}

async function readAllPersonnel() {
  const entries = await Promise.all(
    dayNames.map(async day => [day, await readDayFile(day)]),
  );

  return Object.fromEntries(entries);
}

function buildPlanningPads(groups) {
  return planningPads
    .map((pad) => {
      const padGroups = groups.filter(group => pad.codes.includes(group.code));
      const totalColli = padGroups.reduce((sum, group) => sum + group.colli, 0);

      return {
        padName: pad.name,
        totalColli,
        groups: padGroups.map(group => ({
          code: group.code,
          description: group.description,
          colli: group.colli,
        })),
        medewerkers: [''],
      };
    })
    .filter(pad => pad.groups.length > 0);
}

async function parsePlanningPdf(fileName, fileContentBase64) {
  const parsedPayload = await parsePlanningPdfPageOne(Buffer.from(fileContentBase64, 'base64'));

  const groups = ensureArray(parsedPayload.groups)
    .map(group => ({
      code: Number(group.code),
      description: normalizeDescription(group.description),
      colli: Number(group.colli),
    }))
    .filter(group => Number.isFinite(group.code) && Number.isFinite(group.colli) && group.description);

  const documentDate = typeof parsedPayload.documentDate === 'string' ? parsedPayload.documentDate : null;
  const dayKey = detectPlanningDay(fileName, documentDate);

  return {
    dayKey,
    dayLabel: dayLabels[dayKey],
    documentDate,
    documentDateLabel: formatDocumentDate(documentDate),
    sourceFileName: fileName,
    pads: buildPlanningPads(groups),
  };
}

function normalizePlanningExportPayload(body) {
  const dayKey = typeof body.dayKey === 'string' && isValidDay(body.dayKey) ? body.dayKey : 'maandag';

  const pads = ensureArray(body.pads)
    .map(pad => ({
      padName: typeof pad.padName === 'string' ? pad.padName.trim() : '',
      totalColli: Number(pad.totalColli) || 0,
      medewerkers: ensureArray(pad.medewerkers)
        .filter(entry => typeof entry === 'string')
        .map(entry => entry.trim())
        .filter(Boolean),
      groups: ensureArray(pad.groups)
        .map(group => ({
          code: Number(group.code) || 0,
          description: typeof group.description === 'string' ? group.description.trim() : '',
          colli: Number(group.colli) || 0,
        }))
        .filter(group => group.description),
    }))
    .filter(pad => pad.padName);

  return {
    dayKey,
    dayLabel: dayLabels[dayKey],
    sourceFileName: typeof body.sourceFileName === 'string' ? body.sourceFileName : 'planning.pdf',
    documentDateLabel: typeof body.documentDateLabel === 'string' ? body.documentDateLabel : '',
    pads,
  };
}

function buildSpreadsheetXml({ dayLabel, documentDateLabel, sourceFileName, pads }) {
  const rows = [
    [
      { value: `Vulploegplanning ${dayLabel}`, styleId: 'title' },
      { value: '', styleId: 'title' },
      { value: '', styleId: 'title' },
      { value: '', styleId: 'title' },
    ],
    [
      { value: 'Bronbestand', styleId: 'label' },
      { value: sourceFileName, styleId: 'value' },
      { value: 'Datum', styleId: 'label' },
      { value: documentDateLabel || dayLabel, styleId: 'value' },
    ],
    [],
    [
      { value: 'Pad', styleId: 'header' },
      { value: 'Colli', styleId: 'header' },
      { value: 'Medewerkers', styleId: 'header' },
      { value: 'Artikelgroepen', styleId: 'header' },
    ],
  ];

  for (const pad of pads) {
    rows.push([
      { value: pad.padName, styleId: 'value' },
      { value: String(pad.totalColli), styleId: 'number' },
      { value: pad.medewerkers.join(', '), styleId: 'value' },
      {
        value: pad.groups
          .map(group => `${group.code} ${group.description} (${group.colli})`)
          .join(', '),
        styleId: 'wrap',
      },
    ]);
  }

  const rowXml = rows
    .map((row) => {
      const cells = row.length === 0
        ? '<Cell/>'
        : row.map((cell) => {
            const type = cell.styleId === 'number' ? 'Number' : 'String';

            return `<Cell ss:StyleID="${cell.styleId}"><Data ss:Type="${type}">${escapeXml(cell.value)}</Data></Cell>`;
          }).join('');

      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="title">
   <Font ss:Bold="1" ss:Size="16"/>
   <Interior ss:Color="#DCEAF7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#14609E" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="label">
   <Font ss:Bold="1"/>
  </Style>
  <Style ss:ID="value">
   <Alignment ss:Vertical="Top"/>
  </Style>
  <Style ss:ID="number">
   <Alignment ss:Horizontal="Right" ss:Vertical="Top"/>
  </Style>
  <Style ss:ID="wrap">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Planning">
  <Table>
   <Column ss:Width="180"/>
   <Column ss:Width="70"/>
   <Column ss:Width="220"/>
   <Column ss:Width="520"/>
   ${rowXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    response.end();

    return;
  }

  if (url.pathname === '/api/personnel' && request.method === 'GET') {
    sendJson(response, 200, await readAllPersonnel());

    return;
  }

  if (url.pathname === '/api/planning/parse' && request.method === 'POST') {
    try {
      const body = await readJsonBody(request);
      const fileName = typeof body.fileName === 'string' ? body.fileName : '';
      const fileContentBase64 = typeof body.fileContentBase64 === 'string' ? body.fileContentBase64 : '';

      if (!fileName.toLowerCase().endsWith('.pdf')) {
        sendJson(response, 400, { message: 'Upload voor nu een PDF-bestand.' });

        return;
      }

      if (!fileContentBase64) {
        sendJson(response, 400, { message: 'Geen PDF-inhoud ontvangen.' });

        return;
      }

      sendJson(response, 200, await parsePlanningPdf(fileName, fileContentBase64));

      return;
    }
    catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : 'Kon planning niet uitlezen.',
      });

      return;
    }
  }

  if (url.pathname === '/api/planning/export' && request.method === 'POST') {
    try {
      const body = await readJsonBody(request);
      const planningPayload = normalizePlanningExportPayload(body);
      const fileName = `planning-${planningPayload.dayKey}.xls`;

      sendExcelFile(response, fileName, buildSpreadsheetXml(planningPayload));

      return;
    }
    catch (error) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : 'Kon Excelbestand niet maken.',
      });

      return;
    }
  }

  const personnelMatch = url.pathname.match(/^\/api\/personnel\/([^/]+)$/);

  if (personnelMatch && request.method === 'GET') {
    const day = decodeURIComponent(personnelMatch[1]);

    if (!isValidDay(day)) {
      sendJson(response, 404, { message: 'Dag niet gevonden.' });

      return;
    }

    sendJson(response, 200, await readDayFile(day));

    return;
  }

  if (personnelMatch && request.method === 'PUT') {
    const day = decodeURIComponent(personnelMatch[1]);

    if (!isValidDay(day)) {
      sendJson(response, 404, { message: 'Dag niet gevonden.' });

      return;
    }

    let parsedBody;

    try {
      parsedBody = await readJsonBody(request);
    }
    catch {
      sendJson(response, 400, { message: 'Ongeldige JSON-body.' });

      return;
    }

    if (!Array.isArray(parsedBody)) {
      sendJson(response, 400, { message: 'Verwacht een lijst met namen.' });

      return;
    }

    const savedNames = await writeDayFile(day, parsedBody);

    sendJson(response, 200, { day, names: savedNames });

    return;
  }

  sendJson(response, 404, { message: 'Endpoint niet gevonden.' });
});

server.listen(port, '127.0.0.1');
