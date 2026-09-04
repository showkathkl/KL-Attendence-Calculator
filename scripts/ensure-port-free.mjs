import { execFileSync } from 'node:child_process';
import process from 'node:process';

const port = Number(process.argv[2] || 3001);
if (process.platform === 'win32') process.exit(0);

function sh(args) {
  try { return execFileSync('lsof', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

const raw = sh(['-ti', `:${port}`]);
const pids = raw.split(/\s+/).filter(Boolean).map(Number).filter(Boolean);

// Port 3001 is the local development API port for this project. Kill every
// process currently listening on it so a previous crashed dev session cannot
// prevent the new API from starting. This is intentionally limited to the
// requested port and does not touch unrelated ports.
for (const pid of pids) {
  try { process.kill(pid, 'SIGTERM'); } catch {}
}

const deadline = Date.now() + 3000;
while (Date.now() < deadline) {
  if (!sh(['-ti', `:${port}`]).trim()) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const remaining = sh(['-ti', `:${port}`]).split(/\s+/).filter(Boolean).map(Number).filter(Boolean);
for (const pid of remaining) {
  try { process.kill(pid, 'SIGKILL'); } catch {}
}
