import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const csp = config?.app?.security?.csp ?? '';
const requiredRule = "frame-src https://*.yolnoma.uz https://yolnoma.uz";

if (!csp.includes(requiredRule)) {
  throw new Error(`Missing required CSP rule: ${requiredRule}`);
}

console.log('tauri.conf.json is valid; trusted video frame-src rule is present.');
