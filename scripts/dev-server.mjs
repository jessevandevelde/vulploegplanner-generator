/* eslint-disable no-undef */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendPort = '3101';

const backendScript = path.resolve(__dirname, 'backend-server.mjs');
const angularCli = path.resolve(__dirname, '../node_modules/@angular/cli/bin/ng.js');

const processes = [
  spawn(process.execPath, [backendScript], {
    env: {
      ...process.env,
      PORT: backendPort,
    },
    stdio: 'inherit',
    shell: false,
  }),
  spawn(process.execPath, [angularCli, 'serve', '--host', '127.0.0.1'], {
    stdio: 'inherit',
    shell: false,
  }),
];

function shutdown(code = 0) {
  for (const childProcess of processes) {
    if (!childProcess.killed) {
      childProcess.kill();
    }
  }

  process.exit(code);
}

for (const childProcess of processes) {
  childProcess.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
