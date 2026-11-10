#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

function resolvePython() {
  const isWindows = process.platform === 'win32';
  const candidates = [
    path.join(backendDir, '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
    path.join(backendDir, 'venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
    path.join(rootDir, '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
    path.join(rootDir, 'venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const pythonExecutable = resolvePython();

if (!pythonExecutable) {
  console.error('\n================================================================');
  console.error('[Threadline Error] Backend virtual environment not found!');
  console.error('Expected virtual environment at: backend/.venv');
  console.error('----------------------------------------------------------------');
  console.error('Setup instructions:');
  console.error('  1. Navigate to backend:');
  console.error('     cd backend');
  console.error('  2. Create Python virtual environment:');
  console.error('     python -m venv .venv');
  console.error('  3. Install backend dependencies:');
  console.error(
    process.platform === 'win32'
      ? '     .\\.venv\\Scripts\\pip install -r requirements.txt'
      : '     ./.venv/bin/pip install -r requirements.txt'
  );
  console.error('================================================================\n');
  process.exit(1);
}

const args = ['-m', 'pytest', 'tests', '-v'];

const proc = spawn(pythonExecutable, args, {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: backendDir,
  },
});

proc.on('error', (err) => {
  console.error('[Threadline Tests] Failed to start pytest process:', err.message);
  process.exit(1);
});

proc.on('close', (code, signal) => {
  if (signal) {
    process.exit(0);
  }
  process.exit(code || 0);
});

function cleanExit() {
  if (proc && !proc.killed) {
    try {
      proc.kill();
    } catch {
      // ignore
    }
  }
}

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit);

