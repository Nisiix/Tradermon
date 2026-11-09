// Avvia insieme il server locale (API Alpaca) e Vite (gioco con hot reload).
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const procs = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' }),
  spawn(isWin ? 'npx.cmd' : 'npx', ['vite'], { stdio: 'inherit', shell: isWin }),
];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { if (code) stop(); }));
