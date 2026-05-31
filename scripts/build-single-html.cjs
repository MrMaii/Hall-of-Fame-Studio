const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const jsMatch = indexHtml.match(/src="\/assets\/([^"]+\.js)"/);
const cssMatch = indexHtml.match(/href="\/assets\/([^"]+\.css)"/);
if (!jsMatch || !cssMatch) {
  console.error('Could not find /assets/*.js or /assets/*.css in dist/index.html');
  process.exit(1);
}

const js = fs.readFileSync(path.join(dist, 'assets', jsMatch[1]), 'utf8');
const css = fs.readFileSync(path.join(dist, 'assets', cssMatch[1]), 'utf8');

const titleMatch = indexHtml.match(/<title>([^<]*)<\/title>/);
const title = titleMatch ? titleMatch[1] : 'Hall of Fame Studio';

const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

const outDir = path.join(root, '单文件版本');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'hall-of-fame-studio.html');

const single = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${safeJs}
    </script>
  </body>
</html>
`;

fs.writeFileSync(outPath, single, 'utf8');
console.log('Wrote', outPath, `(${single.length} chars)`);
