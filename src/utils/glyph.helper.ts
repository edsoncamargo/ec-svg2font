import {
  FileGlyph,
  GenerateOptions,
  GlyphStream,
  IconDefinition,
} from '../types';

import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import fs from 'fs';
import path from 'path';

interface GenerateSVGFontOptions extends GenerateOptions {
  files?: FileGlyph[];
}

export async function generateSVGFont(
  opts: GenerateSVGFontOptions
): Promise<{ svgFont: string; mapping: IconDefinition[] }> {
  const { fontName, startCode = 0xe000, outputDir, files } = opts;
  const inputDir = opts.inputDir!;
  const svgFiles =
    files ?? fs.readdirSync(inputDir).filter((f) => f.endsWith('.svg'));
  const fontPath = outputDir ? path.join(outputDir, `${fontName}.svg`) : '';
  const fontStream = new SVGIcons2SVGFontStream({
    fontName,
    normalize: true,
    fontHeight: 1000,
  });

  let svgBuffer = '';
  fontStream.on('data', (chunk) => {
    svgBuffer += chunk.toString();
  });

  if (outputDir) fontStream.pipe(fs.createWriteStream(fontPath));

  const mapping: IconDefinition[] = [];

  svgFiles.forEach((g, i) => {
    const file = typeof g === 'string' ? g : g.file;
    const name = typeof g === 'string' ? path.basename(g, '.svg') : g.name;

    const glyph: GlyphStream = fs.createReadStream(path.join(inputDir, file));

    const codeHex =
      typeof g === 'string' || !g.code
        ? (startCode + i).toString(16).toUpperCase()
        : g.code;

    glyph.metadata = {
      unicode: [String.fromCharCode(parseInt(codeHex, 16))],
      name,
    };

    fontStream.write(glyph);

    mapping.push({ name, code: codeHex });
  });

  fontStream.end();

  await new Promise<void>((res) => fontStream.on('finish', () => res()));

  return { svgFont: svgBuffer, mapping };
}
