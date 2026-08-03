// scripts/generate-favicon.mjs — 渲染 logo.svg → app/favicon.ico（PNG-in-ICO）
// 用法：cd frontend && node scripts/generate-favicon.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(frontendDir, 'public/logo.svg'));

// 渲染 32x32 PNG
const png = await sharp(svg).resize(32, 32).png().toBuffer();

// 打包为单入口 ICO（PNG 压缩图标，Vista+ 支持）
const dir = Buffer.alloc(16);
dir.writeUInt8(32, 0);                 // width
dir.writeUInt8(32, 1);                 // height
dir.writeUInt8(0, 2);                  // palette
dir.writeUInt8(0, 3);                  // reserved
dir.writeUInt16LE(1, 4);               // planes
dir.writeUInt16LE(32, 6);              // bit count
dir.writeUInt32LE(png.length, 8);      // size
dir.writeUInt32LE(22, 12);             // offset = 6 (header) + 16 (dir)

const ico = Buffer.concat([
  Buffer.from([0, 0, 1, 0, 1, 0]),     // header: reserved=0, type=1, count=1
  dir,
  png,
]);

writeFileSync(resolve(frontendDir, 'app/favicon.ico'), ico);
console.log('wrote app/favicon.ico', ico.length, 'bytes');
