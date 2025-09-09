import { Readable } from 'stream';
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import fs from 'fs';
import { parse } from 'svgson';
import path from 'path';
import svg2ttf from 'svg2ttf';
import ttf2eot from 'ttf2eot';
import ttf2woff from 'ttf2woff';

/**
 * Config
 */
const JSON_PATH = './selection.json'; // JSON do IcoMoon existente
const SVG_DIR = './svgs'; // Pasta com novos SVGs
const OUTPUT_DIR = './dist'; // Saída das fontes e CSS
const FONT_NAME = 'icons'; // Nome da fonte
const PREFIX = 'brad-icon-'; // Prefixo CSS

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

/**
 * Função para extrair paths do SVG
 */
async function getPathsFromSVG(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const svgJson = await parse(content);
  const paths = [];

  function traverse(node) {
    if (node.name === 'path' && node.attributes?.d)
      paths.push(node.attributes.d);
    if (node.children) node.children.forEach(traverse);
  }

  traverse(svgJson);
  return paths;
}

/**
 * Carrega o JSON do IcoMoon
 */
const icomoonJson = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

/**
 * Descobre os próximos índices e código Unicode
 */
let nextId = Math.max(...icomoonJson.icons.map((i) => i.properties.id)) + 1;
let nextCode = Math.max(...icomoonJson.icons.map((i) => i.properties.code)) + 1;
let nextOrder =
  Math.max(...icomoonJson.icons.map((i) => i.properties.order)) + 1;
let nextIconIdx = Math.max(...icomoonJson.icons.map((i) => i.iconIdx)) + 1;

/**
 * Adiciona ou substitui cada SVG da pasta
 */
const svgFiles = fs.readdirSync(SVG_DIR).filter((f) => f.endsWith('.svg'));

for (const file of svgFiles) {
  const paths = await getPathsFromSVG(path.join(SVG_DIR, file));
  const name = path.basename(file, '.svg');

  const existingIndex = icomoonJson.icons.findIndex(
    (i) => i.properties.name === name
  );

  const novoIcone = {
    icon: {
      paths,
      attrs: [{}],
      isMulticolor: false,
      isMulticolor2: false,
      grid: 0,
      tags: [name],
    },
    attrs: [{}],
    properties: {
      order:
        existingIndex >= 0
          ? icomoonJson.icons[existingIndex].properties.order
          : nextOrder++,
      id:
        existingIndex >= 0
          ? icomoonJson.icons[existingIndex].properties.id
          : nextId++,
      name,
      prevSize: 32,
      code:
        existingIndex >= 0
          ? icomoonJson.icons[existingIndex].properties.code
          : nextCode++,
    },
    setIdx: 0,
    setId: 2,
    iconIdx:
      existingIndex >= 0
        ? icomoonJson.icons[existingIndex].iconIdx
        : nextIconIdx++,
  };

  if (existingIndex >= 0) {
    icomoonJson.icons[existingIndex] = novoIcone;
    console.log(`Substituído: ${name}`);
  } else {
    icomoonJson.icons.push(novoIcone);
    console.log(`Adicionado: ${name}`);
  }
}

/**
 * Salva o JSON atualizado
 */
const UPDATED_JSON_PATH = path.join(OUTPUT_DIR, 'icons.json');
fs.writeFileSync(UPDATED_JSON_PATH, JSON.stringify(icomoonJson, null, 2));
console.log('JSON atualizado salvo em:', UPDATED_JSON_PATH);

/**
 * Gera SVG Font
 */
const fontStream = new SVGIcons2SVGFontStream({
  fontName: FONT_NAME,
  normalize: true,
  fontHeight: icomoonJson.height || 1024,
});
const svgFontPath = path.join(OUTPUT_DIR, `${FONT_NAME}.svg`);
const svgFontWriteStream = fs.createWriteStream(svgFontPath);
fontStream.pipe(svgFontWriteStream);

icomoonJson.icons.forEach((icon) => {
  const svgContent = `<svg><path d="${icon.icon.paths.join(' ')}"/></svg>`;
  const glyphStream = new Readable();
  glyphStream.push(svgContent);
  glyphStream.push(null);
  glyphStream.metadata = {
    unicode: [String.fromCodePoint(icon.properties.code)],
    name: icon.properties.name,
  };
  fontStream.write(glyphStream);
});

fontStream.end();

/**
 * Quando terminar, converte para TTF, WOFF e EOT e gera demo
 */
svgFontWriteStream.on('finish', async () => {
  const svgFont = fs.readFileSync(svgFontPath, 'utf-8');

  const ttf = svg2ttf(svgFont, {});
  const ttfPath = path.join(OUTPUT_DIR, `${FONT_NAME}.ttf`);
  fs.writeFileSync(ttfPath, Buffer.from(ttf.buffer));

  const eot = ttf2eot(Buffer.from(ttf.buffer));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${FONT_NAME}.eot`),
    Buffer.from(eot.buffer)
  );

  const woff = ttf2woff(ttf);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${FONT_NAME}.woff`),
    Buffer.from(woff.buffer)
  );

  console.log('Fontes geradas: SVG, TTF, WOFF, EOT');

  /**
   * Gera CSS
   */
  let css = `@font-face {
  font-family: '${FONT_NAME}';
  src: url('${FONT_NAME}.eot');
  src: url('${FONT_NAME}.eot?#iefix') format('embedded-opentype'),
       url('${FONT_NAME}.woff') format('woff'),
       url('${FONT_NAME}.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}\n\n`;

  icomoonJson.icons.forEach((icon) => {
    const codeHex = icon.properties.code.toString(16);
    css += `.${PREFIX}${icon.properties.name}:before { content: "\\${codeHex}"; }\n`;
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, `${FONT_NAME}.css`), css);
  console.log('CSS gerado!');

  /**
   * Gera demo HTML
   */
  const htmlPath = path.join(OUTPUT_DIR, 'index.html');
  let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Demo ${FONT_NAME}</title>
<link rel="stylesheet" href="${FONT_NAME}.css" />
<style>
body { font-family: sans-serif; padding: 20px; }
.icon-container { display: flex; flex-wrap: wrap; }
.icon-box { width: 100px; text-align: center; margin: 10px; }
.icon-box span { font-family: '${FONT_NAME}'; font-size: 16px; display: block; margin-bottom: 5px; }
.icon-name { font-size: 12px; word-break: break-all; }
</style>
</head>
<body>
<h1>Demo da fonte ${FONT_NAME}</h1>
<div class="icon-container">
`;

  icomoonJson.icons.forEach((icon) => {
    html += `
<div class="icon-box">
  <span class="${PREFIX}${icon.properties.name}"></span>
  <span class="icon-name">${icon.properties.name} - </br> /${icon.properties.code} </span>
</div>
`;
  });

  html += `
</div>
</body>
</html>
`;

  fs.writeFileSync(htmlPath, html);
  console.log('index.html de demo gerado em:', htmlPath);

  fs.writeFileSync(JSON_PATH, JSON.stringify(icomoonJson, null, 2));
  console.log('selection.json atualizado com os novos ícones!');
});
