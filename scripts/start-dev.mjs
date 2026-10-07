import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const portalDir = fileURLToPath(new URL('../', import.meta.url));
const apiDir = fileURLToPath(new URL('../../elwood/dotnet/src/Elwood.Runtime.Api/', import.meta.url));
const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));

if (!existsSync(apiDir) || !existsSync(nextCli)) {
  console.error('Clone elwood alongside elwood-portal and run npm ci in elwood-portal first.');
  process.exit(1);
}

const children = [];
let stopping = false;

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  await Promise.all(children.map(child => new Promise(resolve => {
    if (!child.pid) return resolve();
    if (process.platform === 'win32') {
      // Stop only process trees started here, including dotnet's child host.
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true, stdio: 'ignore',
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ }
      resolve();
    }
  })));
  process.exit(exitCode);
}

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, ...(name === 'Runtime API' ? { Elwood__Management__LocalDevelopment: 'true' } : {}) },
    detached: process.platform !== 'win32',
  });
  children.push(child);
  child.once('error', error => {
    console.error(`${name}: ${error.message}`);
    void stop(1);
  });
  child.once('exit', code => {
    if (!stopping) {
      console.error(`${name} stopped; shutting down both servers.`);
      void stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => { void stop(0); });
process.on('SIGTERM', () => { void stop(0); });

console.log('Runtime API: http://localhost:5000 | Portal: http://localhost:3000');
console.log('Press Ctrl+C to stop both.');
// Pipelines and local secrets resolve relative to the API working directory.
start('Runtime API', 'dotnet', ['run', '--no-launch-profile', '--urls', 'http://localhost:5000'], apiDir);
start('Portal', process.execPath, [nextCli, 'dev', '--port', '3000'], portalDir);
