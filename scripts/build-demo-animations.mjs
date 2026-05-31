/**
 * Build animated WebP/GIF from captured PNG frames using gifenc (no ffmpeg).
 * Usage: node scripts/build-demo-animations.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pkg from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'assets');

async function loadPng(file) {
  const buf = await readFile(file);
  return PNG.sync.read(buf);
}

function resizeNearest(png, targetW, targetH) {
  const { width, height, data } = png;
  const out = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sx = Math.floor((x / targetW) * width);
      const sy = Math.floor((y / targetH) * height);
      const si = (sy * width + sx) * 4;
      const di = (y * targetW + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { width: targetW, height: targetH, data: out };
}

async function pngToGif(name, frameFiles, delayMs = 900) {
  const targetW = 960;
  const targetH = 540;
  const gif = GIFEncoder();
  let first = true;

  for (const file of frameFiles) {
    const png = resizeNearest(await loadPng(file), targetW, targetH);
    const rgba = png.data;
    const format = 'rgba4444';
    const palette = quantize(rgba, 256, { format, oneBitAlpha: true });
    const index = applyPalette(rgba, palette, format);
    gif.writeFrame(index, targetW, targetH, {
      palette,
      delay: delayMs,
      dispose: 2,
    });
    first = false;
  }

  gif.finish();
  const outPath = path.join(OUT, `${name}.gif`);
  await writeFile(outPath, Buffer.from(gif.bytes()));
  console.log('saved', outPath);
}

async function main() {
  const sequences = {
    'demo-pantheon': ['demo-pantheon.png', 'demo-dossier.png'],
    'demo-kickoff': ['demo-kickoff.png'],
    'demo-manager': ['demo-dashboard.png', 'demo-manager.png'],
    'demo-workspace': ['demo-workspace-2.png', 'demo-workspace.png'],
  };

  const files = await readdir(OUT);

  for (const [name, frames] of Object.entries(sequences)) {
    const existing = frames.filter((f) => files.includes(f));
    if (existing.length === 0) {
      const fallback = files.find((f) => f.startsWith(name.replace('.gif', '')) && f.endsWith('.png'));
      if (fallback) {
        await pngToGif(name, [path.join(OUT, fallback)], 1200);
      }
      continue;
    }
    await pngToGif(
      name,
      existing.map((f) => path.join(OUT, f)),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
