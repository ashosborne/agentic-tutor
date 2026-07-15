/**
 * Records a parent-facing walkthrough of the guided tutor loop in DEMO_MODE
 * (stubbed worksheet + scan assessor — no live LLM calls).
 *
 * Usage (from app/): node scripts/record-tutor-demo.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = '/opt/cursor/artifacts';
const VIDEO_DIR = path.join(ARTIFACTS, 'tutor-demo-raw');
const OUT_WEBM = path.join(ARTIFACTS, 'tutor-demo-stubbed.webm');
const OUT_MP4 = path.join(ARTIFACTS, 'tutor-demo-stubbed.mp4');
const FIXTURE_SCAN = path.join(APP_ROOT, 'fixtures/scans/demo-scan-sea-life.svg');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function run(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: APP_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${cmd}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${cmd}] ${d}`));
  return child;
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  // Fresh demo data with tutor profiles
  await new Promise((resolve, reject) => {
    const seed = spawn('npx', ['tsx', 'server/src/db/seed.ts', '--reset'], {
      cwd: APP_ROOT,
      env: { ...process.env, DEMO_MODE: 'true' },
      stdio: 'inherit',
    });
    seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed failed: ${code}`))));
  });

  const api = run('npx', ['tsx', 'server/src/index.ts'], {
    DEMO_MODE: 'true',
    API_PORT: '8787',
  });
  const vite = run('npx', [
    'vite',
    '--config',
    'client/vite.config.ts',
    '--host',
    '127.0.0.1',
    '--port',
    '5173',
  ]);

  const stop = () => {
    api.kill('SIGTERM');
    vite.kill('SIGTERM');
  };
  process.on('exit', stop);
  process.on('SIGINT', () => {
    stop();
    process.exit(1);
  });

  try {
    await waitForUrl('http://127.0.0.1:8787/api/health');
    await waitForUrl('http://127.0.0.1:5173');

    const browser = await chromium.launch({
      headless: true,
      slowMo: 350,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: {
        dir: VIDEO_DIR,
        size: { width: 1280, height: 800 },
      },
    });
    const page = await context.newPage();

    // 1. Home
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('heading', { name: /Whose learning adventure/i }).waitFor();
    await sleep(1200);

    // 2. Choose Maya
    await page.getByRole('button', { name: /Maya/i }).click();
    await page.getByRole('link', { name: /Continue with the tutor/i }).waitFor();
    await sleep(1400);

    // 3. Guided tutor lesson
    await page.getByRole('link', { name: /Continue with the tutor/i }).click();
    await page.getByText(/Today’s lesson for Maya/i).waitFor();
    await sleep(1400);

    // 4. Theme + create (demo stub image generator)
    const theme = page.getByPlaceholder(/unicorns|sea life|space/i);
    await theme.fill('');
    await theme.fill('sea life');
    await sleep(600);
    await page.getByRole('button', { name: /Create today’s worksheet/i }).click();
    await page.getByText(/Ready to print/i).waitFor({ timeout: 30_000 });
    await sleep(1500);

    // 5. Upload scan (demo stub assessor)
    await page.getByRole('button', { name: /Upload scan when done/i }).click();
    await page.getByText(/Upload scan/i).waitFor();
    await sleep(800);
    await page.setInputFiles('input[type="file"]', FIXTURE_SCAN);
    await page.getByRole('heading', { name: /How it went/i }).waitFor({ timeout: 30_000 });
    await sleep(1600);

    // 6. Parent “how it went” report
    await page.getByRole('button', { name: /Tell us how it felt/i }).click();
    await page.getByText(/Did they finish the main part/i).waitFor();
    await sleep(800);
    await page.getByRole('button', { name: /^Yes$/i }).click();
    await sleep(300);
    await page.getByRole('button', { name: /Enjoyment 5 of 5/i }).click();
    await sleep(300);
    await page.getByRole('button', { name: /^Easy$/i }).click();
    await sleep(500);
    await page.getByRole('button', { name: /Save how it went/i }).click();
    await page.getByRole('heading', { name: /Here’s what we’ll try next/i }).waitFor({
      timeout: 15_000,
    });
    await sleep(1600);

    // 7. Insights
    await page.getByRole('link', { name: /See insights/i }).click();
    await page.getByRole('heading', { name: /What seems to help Maya/i }).waitFor();
    await sleep(2200);

    await context.close();
    await browser.close();

    const videos = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'));
    if (videos.length === 0) throw new Error('No Playwright video produced');
    const raw = path.join(VIDEO_DIR, videos[0]);
    fs.copyFileSync(raw, OUT_WEBM);

    // Prefer mp4 for broader playback
    await new Promise((resolve, reject) => {
      const ff = spawn(
        'ffmpeg',
        [
          '-y',
          '-i',
          OUT_WEBM,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          OUT_MP4,
        ],
        { stdio: 'inherit' },
      );
      ff.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${code}`)),
      );
    });

    console.log(`Wrote ${OUT_MP4}`);
    console.log(`Also kept ${OUT_WEBM}`);
  } finally {
    stop();
    await sleep(500);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
