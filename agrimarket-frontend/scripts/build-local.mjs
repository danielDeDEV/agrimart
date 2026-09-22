/**
 * A production build for testing on this machine.
 *
 * `next build` always runs as NODE_ENV=production, so the configuration check
 * in next.config.mjs would refuse a build that still points at localhost —
 * which is exactly right for a deploy, and in the way when you just want to
 * see the optimised build locally. This skips that one check; everything else
 * about the build is identical.
 *
 *   npm run build:local
 *
 * Works the same on Windows, macOS and Linux, where `SKIP_ENV_CHECK=1 next
 * build` would not.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const next = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

console.log('Building locally (configuration check skipped — do not deploy this build blindly).\n');

const child = spawn(process.execPath, [next, 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SKIP_ENV_CHECK: '1' },
});

child.on('exit', (code) => process.exit(code ?? 1));
