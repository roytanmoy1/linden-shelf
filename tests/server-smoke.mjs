import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const address = probe.address();
assert.ok(address && typeof address !== 'string');
const port = address.port;
await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));

const child = spawn(process.execPath, ['services/catalogue-api/dist/server.js'], {
  cwd: root,
  env: {
    SystemRoot: process.env.SystemRoot ?? '', PATH: process.env.PATH ?? '',
    HOST: '127.0.0.1', PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(child, 'exit');
let errorLog = '';
child.stderr.on('data', (chunk) => { errorLog = (errorLog + chunk.toString()).slice(-4000); });

try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('API readiness deadline exceeded.')), 10000);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('"event":"api_listening"')) {
        clearTimeout(deadline);
        resolve();
      }
    });
    child.once('error', (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(deadline);
      reject(new Error(`API exited before readiness (${code}): ${errorLog}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', services: { api: 'ready' } });
  const invalidId = await fetch(`${baseUrl}/api/products/0`, { signal: AbortSignal.timeout(3000) });
  assert.equal(invalidId.status, 400);
  assert.equal((await invalidId.json()).error.code, 'BAD_REQUEST');
  const invalidEnquiry = await fetch(`${baseUrl}/api/enquiries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(3000),
  });
  assert.equal(invalidEnquiry.status, 422);
  assert.equal((await invalidEnquiry.json()).error.code, 'VALIDATION_ERROR');
  console.log(JSON.stringify({
    event: 'compiled_server_smoke_passed', checks: ['health', 'invalid ID', 'invalid enquiry'],
    time: new Date().toISOString(),
  }));
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await exited;
}