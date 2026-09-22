const fs = require('fs');
const path = require('path');

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};

const stamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

/**
 * In production the interesting lines are also kept on disk.
 *
 * A terminal closes, a service restarts, and the one message explaining why
 * farmers stopped receiving SMS on Tuesday goes with it. Warnings and errors
 * are appended to a file per day under `logs/` (LOG_DIR to move it), pruned
 * after LOG_KEEP_DAYS. Writing is best-effort: a full disk must never stop the
 * platform from serving.
 */
const fileLogging = process.env.NODE_ENV === 'production' || !!process.env.LOG_DIR;
const logDir = path.resolve(process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs'));
const keepDays = Number(process.env.LOG_KEEP_DAYS || 14);

let stream = null;
let streamDay = null;
let warnedOnce = false;

const stripColour = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

const formatArg = (arg) => {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'object' && arg !== null) {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
};

/** Deletes log files older than the retention window. */
function prune() {
  if (!keepDays) return;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(logDir)) {
      if (!name.endsWith('.log')) continue;
      const full = path.join(logDir, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch { /* pruning is housekeeping, never critical */ }
}

/** The stream for today, rotating at midnight. */
function currentStream() {
  const day = new Date().toISOString().slice(0, 10);
  if (stream && streamDay === day) return stream;

  try {
    fs.mkdirSync(logDir, { recursive: true });
    if (stream) stream.end();
    stream = fs.createWriteStream(path.join(logDir, `agrimart-${day}.log`), { flags: 'a' });
    stream.on('error', () => { stream = null; });
    streamDay = day;
    prune();
    return stream;
  } catch (err) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.log(`${c.yellow}[WARN ]${c.reset} Could not open the log file at ${logDir}: ${err.message}`);
    }
    return null;
  }
}

function toFile(tag, args) {
  if (!fileLogging) return;
  const target = currentStream();
  if (!target) return;
  try {
    target.write(`${stamp()} ${tag} ${args.map(formatArg).join(' ')}\n`);
  } catch { /* best effort */ }
}

const write = (color, tag, args, persist = false) => {
  console.log(`${c.dim}${stamp()}${c.reset} ${color}${tag}${c.reset}`, ...args);
  if (persist) toFile(stripColour(tag), args);
};

module.exports = {
  info: (...a) => write(c.blue, '[INFO ]', a),
  success: (...a) => write(c.green, '[ OK  ]', a),
  // Warnings and errors are what you go looking for after the fact
  warn: (...a) => write(c.yellow, '[WARN ]', a, true),
  error: (...a) => write(c.red, '[ERROR]', a, true),
  debug: (...a) => process.env.NODE_ENV !== 'production' && write(c.magenta, '[DEBUG]', a),
  ussd: (...a) => write(c.cyan, '[USSD ]', a),
  sms: (...a) => write(c.magenta, '[ SMS ]', a),
  /** Where the files are, for the deployment docs and the health output. */
  logDir,
  fileLogging,
};
