import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..');
const expectedNodeMajor = 22;

function fail(message, details = []) {
  console.error(`\nDevelopment environment is not ready: ${message}`);

  for (const detail of details) {
    console.error(`- ${detail}`);
  }

  console.error('\nRun:');
  console.error('  npm ci');
  console.error('  npm start\n');

  process.exit(1);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);

if (nodeMajor !== expectedNodeMajor) {
  fail(`Node ${process.versions.node} is active, but this project expects Node ${expectedNodeMajor}.x.`, [
    'Install/use Node 22.20.0 for this project.',
    'With nvm-windows: nvm install 22.20.0 && nvm use 22.20.0',
    'With fnm: fnm install 22.20.0 && fnm use',
  ]);
}

if (!existsSync(path.join(projectRoot, 'node_modules'))) {
  fail('node_modules is missing.');
}

for (const packageName of ['@angular/cli', 'pdfjs-dist']) {
  try {
    require.resolve(`${packageName}/package.json`, {
      paths: [projectRoot],
    });
  }
  catch {
    fail(`${packageName} is missing from node_modules.`, [
      'This usually means dependencies were copied, partially deleted, or installed from a different folder.',
    ]);
  }
}

try {
  require.resolve('pdfjs-dist/legacy/build/pdf.js', {
    paths: [projectRoot],
  });
}
catch {
  fail('pdfjs-dist is installed incompletely or at an incompatible version.', [
    'Delete node_modules and run npm ci from the project folder.',
    'Do not rely on a Node or node_modules folder next to the project.',
  ]);
}
