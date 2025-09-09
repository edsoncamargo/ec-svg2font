// utils/glyph.helper.ts

import { FileGlyph, GenerateOptions, IconDefinition } from '../types';

import { Readable } from 'stream';
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import fs from 'fs';
import path from 'path';

interface GenerateSVGFontOptions extends GenerateOptions {
  files?: FileGlyph[];
  existingMapping?: IconDefinition[];
}

export async function generateSVGFont(
  opts: GenerateSVGFontOptions
): Promise<{ svgFont: string; mapping: IconDefinition[] }> {
  const {
    fontName,
    startCode = 0xe000,
    outputDir,
    files = [],
    existingMapping = [],
  } = opts;
  const inputDir = opts.inputDir!;

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

  if (outputDir) {
    fontStream.pipe(fs.createWriteStream(fontPath));
  }

  const finalMapping: IconDefinition[] = [];
  const processedNames = new Set<string>();

  // ---- 1. Reconstrói todos os ícones que estavam no JSON, na ordem original ----
  for (const original of existingMapping) {
    let glyphContent = original.svg || null;
    let updatedIcon: IconDefinition | null = null;

    const updatedFile = files.find((f) => f.name === original.name);

    try {
      if (updatedFile) {
        // prioridade ao enviado agora
        glyphContent = fs.readFileSync(
          path.join(inputDir, updatedFile.file),
          'utf8'
        );
        updatedIcon = {
          ...original,
          file: updatedFile.file,
          svg: glyphContent,
        };
      } else if (!glyphContent && original.file) {
        // se não tem svg no json, mas existe arquivo no disco
        const filePath = path.join(inputDir, original.file);
        if (fs.existsSync(filePath)) {
          glyphContent = fs.readFileSync(filePath, 'utf8');
        }
        updatedIcon = {
          ...original,
          svg: glyphContent || undefined,
        };
      } else {
        // já tinha svg no JSON
        updatedIcon = { ...original, svg: glyphContent || undefined };
      }

      if (glyphContent) {
        const glyphStream = new Readable();
        glyphStream.push(glyphContent);
        glyphStream.push(null);
        (glyphStream as any).metadata = {
          unicode: [String.fromCharCode(parseInt(original.code, 16))],
          name: original.name,
        };
        fontStream.write(glyphStream);
      }

      finalMapping.push(updatedIcon);
      processedNames.add(original.name);
    } catch (err) {
      console.error(`Erro ao processar ícone ${original.name}:`, err);
    }
  }

  // ---- 2. Adiciona novos ícones (não estavam no JSON) ----
  let nextCode =
    finalMapping.length > 0
      ? parseInt(finalMapping[finalMapping.length - 1].code, 16) + 1
      : startCode;

  for (const fileGlyph of files) {
    if (processedNames.has(fileGlyph.name)) continue;

    try {
      const glyphContent = fs.readFileSync(
        path.join(inputDir, fileGlyph.file),
        'utf8'
      );

      const code = nextCode.toString(16).toUpperCase();
      nextCode++;

      const newIcon: IconDefinition = {
        file: fileGlyph.file,
        name: fileGlyph.name,
        code,
        svg: glyphContent,
      };

      const glyphStream = new Readable();
      glyphStream.push(glyphContent);
      glyphStream.push(null);
      (glyphStream as any).metadata = {
        unicode: [String.fromCharCode(parseInt(code, 16))],
        name: fileGlyph.name,
      };
      fontStream.write(glyphStream);

      finalMapping.push(newIcon);
      processedNames.add(fileGlyph.name);
    } catch (err) {
      console.error(`Erro ao adicionar novo ícone ${fileGlyph.name}:`, err);
    }
  }

  fontStream.end();
  await new Promise<void>((resolve, reject) => {
    fontStream.on('finish', () => resolve());
    fontStream.on('error', (err) => reject(err));
  });

  // 🔑 Não reordena → mantém ordem do JSON + novos no fim
  return { svgFont: svgBuffer, mapping: finalMapping };
}
