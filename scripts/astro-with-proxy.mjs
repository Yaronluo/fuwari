import { spawn } from 'node:child_process';

// Keep local network settings with the rest of the project's environment
// configuration instead of relying on how the terminal was launched.
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (process.env.BANGUMI_PROXY) {
  process.env.HTTPS_PROXY ??= process.env.BANGUMI_PROXY;
  process.env.HTTP_PROXY ??= process.env.BANGUMI_PROXY;
}

// Node's fetch does not read HTTP(S)_PROXY unless this flag is enabled before
// the process starts. The Astro child process therefore needs to inherit it.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  process.env.NODE_USE_ENV_PROXY ??= '1';
}

const astroArgs = process.argv.slice(2);
const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const commandArgs = isWindows
  ? ['/d', '/s', '/c', ['pnpm', 'exec', 'astro', ...astroArgs].join(' ')]
  : ['exec', 'astro', ...astroArgs];
const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error(`启动 Astro 失败: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
