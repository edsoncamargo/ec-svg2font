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
 * Função para extrair paths agrupados por cor
 * Agora retorna um objeto onde as chaves são as cores e os valores são os paths
 */
async function getPathsFromSVG(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const svgJson = await parse(content);

  const colorGroups = {};

  function traverse(node) {
    if (node.name === 'path' && node.attributes?.d) {
      const color = node.attributes.fill || 'currentColor';
      if (!colorGroups[color]) colorGroups[color] = [];
      colorGroups[color].push(node.attributes.d);
    } else if (
      node.name === 'circle' &&
      node.attributes?.cx &&
      node.attributes?.cy &&
      node.attributes?.r
    ) {
      const { cx, cy, r } = node.attributes;
      // Converte círculo para path
      const d = `M${cx},${cy}m-${r},0a${r},${r} 0 1,0 ${
        r * 2
      },0a${r},${r} 0 1,0 -${r * 2},0`;
      const color = node.attributes.fill || 'currentColor';
      if (!colorGroups[color]) colorGroups[color] = [];
      colorGroups[color].push(d);
    }
    // Adicionar suporte para outros elementos que podem ter cor, como <rect>, <polygon>, etc.
    // Se necessário, você pode expandir esta função para lidar com mais formas.
    if (node.children) node.children.forEach(traverse);
  }

  traverse(svgJson);

  // Retorna apenas os grupos de cores e seus paths
  return { colorGroups };
}

/**
 * Carrega o JSON do IcoMoon
 */
const icomoonJson = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

/**
 * Descobre os próximos índices e código Unicode
 * Iniciando com valores altos para evitar conflitos com ícones existentes,
 * se a lógica de sobrescrita for complexa, talvez seja melhor ler o último valor usado.
 */
let nextId = Math.max(0, ...icomoonJson.icons.map((i) => i.properties.id)) + 1;
let nextCode =
  Math.max(0, ...icomoonJson.icons.map((i) => i.properties.code)) + 1;
let nextOrder =
  Math.max(0, ...icomoonJson.icons.map((i) => i.properties.order)) + 1;
let nextIconIdx = Math.max(0, ...icomoonJson.icons.map((i) => i.iconIdx)) + 1;

/**
 * Adiciona ou substitui cada SVG da pasta
 * Agora, cada cor de um SVG se torna um ícone separado (camada).
 */
const svgFiles = fs.readdirSync(SVG_DIR).filter((f) => f.endsWith('.svg'));
const newIconsData = []; // Array temporário para armazenar os novos ícones gerados

// Remove ícones existentes que correspondem aos nomes dos SVGs processados
const baseNamesFromSvgFiles = svgFiles.map((f) => path.basename(f, '.svg'));
icomoonJson.icons = icomoonJson.icons.filter(
  (icon) =>
    !baseNamesFromSvgFiles.some((baseName) =>
      icon.properties.name.startsWith(baseName)
    )
);

for (const file of svgFiles) {
  const { colorGroups } = await getPathsFromSVG(path.join(SVG_DIR, file));
  const baseName = path.basename(file, '.svg');

  // Itera sobre cada grupo de cores (cada camada)
  Object.entries(colorGroups).forEach(([color, paths], layerIndex) => {
    const layerName = `${baseName}-${layerIndex}`; // Nome único para cada camada: ex: 'iconName-0', 'iconName-1'

    // Cria um novo ícone para esta camada
    const novoIcone = {
      icon: {
        paths, // Apenas os paths desta cor
        attrs: [{ fill: color }], // Atributos específicos desta cor
        isMulticolor: false, // Cada glifo individual é monocromático
        isMulticolor2: false,
        grid: 0,
        tags: [baseName, layerName], // Tags para referência
      },
      attrs: [{ fill: color }], // Atributos gerais do ícone (pode ser usado se necessário)
      properties: {
        order: nextOrder++,
        id: nextId++,
        name: layerName, // Nome da camada
        prevSize: 32,
        code: nextCode++, // Novo código Unicode para esta camada
      },
      setIdx: 0,
      setId: 2,
      iconIdx: nextIconIdx++,
    };
    newIconsData.push(novoIcone);
    console.log(`Processado: ${layerName} (cor: ${color})`);
  });
}

// Adiciona todos os novos ícones gerados à lista principal
icomoonJson.icons.push(...newIconsData);

/**
 * Salva o JSON atualizado
 */
const UPDATED_JSON_PATH = path.join(OUTPUT_DIR, 'selection.json'); // Salva no mesmo local ou em um novo
fs.writeFileSync(UPDATED_JSON_PATH, JSON.stringify(icomoonJson, null, 2));
console.log('selection.json atualizado salvo em:', UPDATED_JSON_PATH);

/**
 * Gera SVG Font
 */
const fontStream = new SVGIcons2SVGFontStream({
  fontName: FONT_NAME,
  normalize: true,
  centerHorizontally: true,
  centerVertically: true,
  metadata: null, // metadata: 'Some metadata'
  preserveAspectRatio: true,
});
const svgFontPath = path.join(OUTPUT_DIR, `${FONT_NAME}.svg`);
const svgFontWriteStream = fs.createWriteStream(svgFontPath);
fontStream.pipe(svgFontWriteStream);

// Itera sobre todos os ícones (agora fragmentados por cor) para gerar os glifos
icomoonJson.icons.forEach((icon) => {
  // Monta um único <svg> com o path desta camada específica
  const svgContent = `<svg>${icon.icon.paths
    .map((d, i) => {
      // Usa a cor definida para esta camada, ou currentColor como fallback
      const color = icon.icon.attrs[i]?.fill || 'currentColor';
      return `<path fill="${color}" d="${d}"/>`;
    })
    .join('')}</svg>`;

  const glyphStream = new Readable();
  glyphStream.push(svgContent);
  glyphStream.push(null);

  glyphStream.metadata = {
    unicode: [String.fromCodePoint(icon.properties.code)],
    name: icon.properties.name, // Nome da camada (ex: 'iconName-0')
  };

  fontStream.write(glyphStream);
});

fontStream.end();

/**
 * Quando terminar, converte para TTF, WOFF e EOT e gera demo
 */
svgFontWriteStream.on('finish', async () => {
  const svgFont = fs.readFileSync(svgFontPath, 'utf-8');

  // Converte SVG para TTF
  const ttf = svg2ttf(svgFont, {});
  const ttfPath = path.join(OUTPUT_DIR, `${FONT_NAME}.ttf`);
  fs.writeFileSync(ttfPath, Buffer.from(ttf.buffer));

  // Converte TTF para EOT
  const eot = ttf2eot(Buffer.from(ttf.buffer));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${FONT_NAME}.eot`),
    Buffer.from(eot.buffer)
  );

  // Converte TTF para WOFF
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

  // Agrupa os ícones pelo nome base (sem o sufixo de camada)
  const baseIconsMap = {};
  icomoonJson.icons.forEach((icon) => {
    // Extrai o nome base (ex: "feedback-view-on" de "feedback-view-on-0")
    const baseName = icon.properties.name.split('-').slice(0, -1).join('-');

    if (!baseIconsMap[baseName]) {
      baseIconsMap[baseName] = [];
    }
    baseIconsMap[baseName].push(icon);
  });

  // Gera as regras CSS para cada ícone base e suas camadas
  for (const [baseName, layers] of Object.entries(baseIconsMap)) {
    // Regra para o container principal do ícone, definindo posição para os pseudo-elementos
    css += `.${PREFIX}${baseName} {
  position: relative;
  display: inline-block; /* Ou outro display apropriado */
  width: 1em; /* Define um tamanho base, pode ser ajustado */
  height: 1em;
  vertical-align: middle; /* Alinha corretamente com texto */
}\n\n`;

    // Gera regras para cada camada usando pseudo-elementos
    layers.forEach((icon, index) => {
      const codeHex = icon.properties.code.toString(16);
      const color = icon.icon.attrs[0]?.fill || 'currentColor'; // Pega a cor definida para a camada

      // Determina o pseudo-elemento. Você pode querer um sistema mais robusto se houver mais de 2 cores.
      const pseudoElement = index === 0 ? '::before' : '::after';
      // Se precisar de mais de 2 camadas, você teria que pensar em uma convenção de nomes para pseudo-elementos
      // ex: .icon-name::nth-layer(1) { ... } ou .icon-name-layer-1 { ... }

      css += `.${PREFIX}${baseName}${pseudoElement} {
  content: "\\${codeHex}";
  font-family: '${FONT_NAME}';
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  color: ${color}; /* Define a cor original da camada */
}\n`;
    });
    css += '\n'; // Espaço entre blocos de ícones
  }

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
.icon-box { width: 120px; text-align: center; margin: 10px; border: 1px solid #eee; padding: 10px; }
.icon-box span.icon-display {
  font-family: '${FONT_NAME}';
  font-size: 32px; /* Tamanho maior para visualização */
  display: block;
  margin-bottom: 10px;
  color: #333; /* Cor padrão para o container */
}
.icon-name { font-size: 12px; word-break: break-all; display: block; margin-top: 5px;}
.icon-layer-info { font-size: 10px; color: #777; margin-top: 2px; }
</style>
</head>
<body>
<h1>Demo da fonte ${FONT_NAME}</h1>
<div class="icon-container">
`;

  // Itera sobre os ícones base para montar a demo HTML
  for (const [baseName, layers] of Object.entries(baseIconsMap)) {
    html += `
<div class="icon-box">
  <span class="${PREFIX}${baseName}">
    </span>
  <span class="icon-name">${baseName}</span>
`;
    // Adiciona informações sobre as camadas
    layers.forEach((layerIcon, index) => {
      const color = layerIcon.icon.attrs[0]?.fill || 'transparent';
      html += `<span class="icon-layer-info">Camada ${index}: ${layerIcon.properties.name} (cor: ${color})</span>`;
    });
    html += `</div>`;
  }

  html += `
</div>
</body>
</html>
`;

  fs.writeFileSync(htmlPath, html);
  console.log('index.html de demo gerado em:', htmlPath);

  // Opcional: salva o JSON modificado novamente, caso as conversões tenham criado novos campos ou você queira ter certeza.
  // fs.writeFileSync(UPDATED_JSON_PATH, JSON.stringify(icomoonJson, null, 2));
  // console.log('selection.json atualizado final salvo em:', UPDATED_JSON_PATH);
});
