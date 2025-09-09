import { Readable } from 'stream';
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import { execSync } from 'child_process'; // Para chamar o SVGO a partir do script
import fs from 'fs';
import { parse } from 'svgson'; // Para a leitura e manipulação de SVGs mais complexa se necessário
import path from 'path';
import pkg from 'svg-path-parser';
import svg2ttf from 'svg2ttf';
import ttf2eot from 'ttf2eot';
import ttf2woff from 'ttf2woff';

const { parseSVGPath } = pkg;

/**
 * Configurações
 */
const JSON_PATH = './selection.json'; // JSON do IcoMoon existente
const SVG_DIR = './svgs'; // Pasta com novos SVGs (DEVE SER PRÉ-PROCESSADO COM SVGO)
const OUTPUT_DIR = './dist'; // Saída das fontes e CSS
const FONT_NAME = 'icons'; // Nome da fonte
const PREFIX = 'brad-icon-'; // Prefixo CSS
const FONT_HEIGHT = 512; // Altura padrão da fonte (ajusta o viewBox interno dos ícones)

// Garante que o diretório de saída exista
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Otimiza SVGs usando SVGO (opcionalmente pode ser executado manualmente)
 * Isso garante que todos os SVGs tenham um viewBox consistente e
 * removam elementos desnecessários que podem causar problemas.
 */
async function optimizeSVGs() {
  console.log('Otimizando SVGs com SVGO...');
  try {
    // Limpa a pasta de SVGs que serão otimizados (opcional)
    // Ou cria uma subpasta para os SVGs otimizados
    const optimizedSvgDir = path.join(OUTPUT_DIR, 'optimized_svgs');
    if (!fs.existsSync(optimizedSvgDir)) {
      fs.mkdirSync(optimizedSvgDir);
    }

    const svgFiles = fs.readdirSync(SVG_DIR).filter((f) => f.endsWith('.svg'));

    for (const file of svgFiles) {
      const inputPath = path.join(SVG_DIR, file);
      const outputPath = path.join(optimizedSvgDir, file);

      // Chama o SVGO via linha de comando. Ajuste o comando se o SVGO não estiver instalado globalmente.
      // Se o SVGO estiver instalado como dependência: `node node_modules/.bin/svgo ...`
      execSync(
        `svgo --config=svgo.config.js --input="${inputPath}" --output="${outputPath}"`
      );
      console.log(`SVG otimizado: ${file}`);
    }
    // Retorna o diretório de SVGs otimizados para serem usados pelo script
    return optimizedSvgDir;
  } catch (error) {
    console.error('Erro ao otimizar SVGs:', error);
    throw error; // Para a execução se a otimização falhar
  }
}

/**
 * Função para extrair paths do SVG otimizado.
 * Agora, assume que o SVG já tem um viewBox e atributos limpos.
 */

async function getPathsFromSVG(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const svgJson = await parse(content);
  const paths = [];

  const viewBox = svgJson.attributes?.viewBox;
  let scaleFactor = 1;
  if (viewBox) {
    const [, , width, height] = viewBox.split(' ').map(Number);
    const maxDimension = Math.max(width, height);
    if (maxDimension > 0) {
      scaleFactor = FONT_HEIGHT / maxDimension;
    }
  }

  function traverse(node) {
    if (node.name === 'path' && node.attributes?.d) {
      const originalPath = node.attributes.d;
      let scaledPath = '';
      try {
        if (typeof parseSVGPath === 'function') {
          const parsedCommands = parseSVGPath(originalPath);
          scaledPath = parsedCommands
            .map((cmd) => {
              let commandString = cmd.command;
              const coordinateKeys = [
                'x',
                'y',
                'x1',
                'y1',
                'x2',
                'y2',
                'rx',
                'ry',
                'r',
              ]; // Include 'r' for arcs/circles

              // Process each coordinate key that exists on the command
              coordinateKeys.forEach((key) => {
                if (cmd[key] !== undefined) {
                  // Ensure the key is appended with its scaled value
                  // We append directly here to preserve command structure like 'M x y'
                  commandString += ` ${cmd[key] * scaleFactor}`;
                }
              });
              return commandString;
            })
            .join(' '); // Join all transformed commands
        } else {
          console.warn(
            'parseSVGPath is not a function. Skipping path scaling.'
          );
          scaledPath = originalPath;
        }
      } catch (error) {
        console.error(`Erro ao processar o path em ${filePath}:`, error);
        scaledPath = originalPath;
      }
      paths.push(scaledPath || originalPath);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
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
let nextId =
  Math.max(0, ...icomoonJson.icons.map((i) => i.properties.id || 0)) + 1;
let nextCode =
  Math.max(0xea01, ...icomoonJson.icons.map((i) => i.properties.code || 0)) + 1; // Começa de um código Unicode privado comum
let nextOrder =
  Math.max(0, ...icomoonJson.icons.map((i) => i.properties.order || 0)) + 1;
let nextIconIdx =
  Math.max(0, ...icomoonJson.icons.map((i) => i.iconIdx || 0)) + 1;

/**
 * Adiciona ou substitui cada SVG da pasta otimizada
 */
async function processSVGs() {
  const optimizedSvgDir = await optimizeSVGs(); // Otimiza os SVGs primeiro
  const svgFiles = fs
    .readdirSync(optimizedSvgDir)
    .filter((f) => f.endsWith('.svg'));

  for (const file of svgFiles) {
    const filePath = path.join(optimizedSvgDir, file);
    const paths = await getPathsFromSVG(filePath);
    const name = path.basename(file, '.svg');

    if (paths.length === 0) {
      console.warn(
        `Aviso: Nenhum path encontrado em ${file}. Ícone será ignorado.`
      );
      continue;
    }

    const existingIndex = icomoonJson.icons.findIndex(
      (i) => i.properties.name === name
    );

    const novoIcone = {
      icon: {
        paths: [paths.join(' ')], // Junta todos os paths em um único string
        attrs: [{}], // Atributos do ícone (geralmente vazios para fontes simples)
        isMulticolor: false,
        isMulticolor2: false,
        grid: 0,
        tags: [name],
      },
      attrs: [{}], // Atributos do set de ícones
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
        prevSize: 32, // Valor padrão, pode ser ajustado
        code:
          existingIndex >= 0
            ? icomoonJson.icons[existingIndex].properties.code
            : nextCode++,
      },
      setIdx: 0, // Índice do set (geralmente 0)
      setId: 2, // ID do set (pode ser ajustado)
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
}

/**
 * Gera SVG Font
 */
async function generateSVGFont() {
  const fontStream = new SVGIcons2SVGFontStream({
    fontName: FONT_NAME,
    normalize: true,
    centerHorizontally: true,
    centerVertically: true,
    metadata: null,
  });

  const svgFontPath = path.join(OUTPUT_DIR, `${FONT_NAME}.svg`);
  const svgFontWriteStream = fs.createWriteStream(svgFontPath);
  fontStream.pipe(svgFontWriteStream);

  icomoonJson.icons.forEach((icon) => {
    // Cria um SVG simples para cada path, garantindo que ele seja processado corretamente
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

  return new Promise((resolve, reject) => {
    svgFontWriteStream.on('finish', resolve);
    svgFontWriteStream.on('error', reject);
  });
}

/**
 * Converte a fonte SVG para outros formatos e gera CSS/HTML
 */
async function convertAndGenerateOutputs() {
  const svgFontPath = path.join(OUTPUT_DIR, `${FONT_NAME}.svg`);
  const svgFont = fs.readFileSync(svgFontPath, 'utf-8');

  // Converte para TTF
  const ttf = svg2ttf(svgFont, {});
  const ttfPath = path.join(OUTPUT_DIR, `${FONT_NAME}.ttf`);
  fs.writeFileSync(ttfPath, Buffer.from(ttf.buffer));

  // Converte para EOT
  const eot = ttf2eot(Buffer.from(ttf.buffer));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${FONT_NAME}.eot`),
    Buffer.from(eot.buffer)
  );

  // Converte para WOFF
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
  <span class="icon-name">${
    icon.properties.name
  } - </br> /${icon.properties.code.toString(16)} </span>
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

  // Salva o JSON atualizado novamente após a geração dos arquivos
  fs.writeFileSync(JSON_PATH, JSON.stringify(icomoonJson, null, 2));
  console.log('selection.json atualizado com os novos ícones!');
}

/**
 * Execução principal
 */
async function main() {
  await processSVGs(); // Processa e atualiza o JSON com os novos ícones
  await generateSVGFont(); // Gera o arquivo .svg da fonte
  await convertAndGenerateOutputs(); // Converte para outros formatos e gera CSS/HTML
  console.log('Processo de geração de fontes concluído!');
}

main().catch(console.error);
