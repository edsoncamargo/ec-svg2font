// utils/glyph.helper.ts

import { FileGlyph, GenerateOptions, IconDefinition } from '../types';

import { Readable } from 'stream';
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import fs from 'fs';
import path from 'path';

interface GenerateSVGFontOptions extends GenerateOptions {
  files?: FileGlyph[]; // Ícones a serem processados para a fonte (existentes válidos + novos)
  existingMapping?: IconDefinition[]; // Mapeamento COMPLETO carregado do JSON
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

  // O mapeamento final que será construído.
  const finalMapping: IconDefinition[] = [];

  // Conjunto para rastrear os nomes dos ícones que já foram processados (para evitar duplicidade)
  const processedNames = new Set<string>();

  // 1. Adiciona os ícones que estavam no JSON mas foram removidos do disco.
  // Estes são preservados no mapeamento final.
  const removedIcons = existingMapping.filter(
    (m) => !files.some((f) => f.name === m.name) // Verifica se o ícone do JSON não está na lista de 'files' a serem processados
  );
  removedIcons.forEach((icon) => {
    finalMapping.push(icon); // Preserva o ícone antigo inteiro
    processedNames.add(icon.name);
  });

  // 2. Processa os ícones que precisam ser gerados para a fonte (existentes válidos e novos).
  let currentCodeOffset = startCode;
  // Se já temos ícones no finalMapping (os removidos), pegamos o último código deles para iniciar a contagem para os novos.
  if (finalMapping.length > 0) {
    const lastCode = parseInt(finalMapping[finalMapping.length - 1].code, 16);
    currentCodeOffset = lastCode + 1;
  }

  for (const fileGlyph of files) {
    // 'files' contém os ícones válidos existentes e os novos
    if (processedNames.has(fileGlyph.name)) {
      continue; // Já foi processado (era um ícone removido mas que voltou, ou algo assim)
    }

    let glyphContent: string | null = null;
    let code: string;
    let finalIconDefinition: IconDefinition;

    // Tenta encontrar o ícone no mapeamento original (existingMapping)
    const foundOriginalIcon = existingMapping.find(
      (m) => m.name === fileGlyph.name
    );

    if (foundOriginalIcon && foundOriginalIcon.svg) {
      // --- Ícone antigo que ainda existe e tinha SVG no JSON: Preserva SVG e código ---
      glyphContent = foundOriginalIcon.svg;
      code = foundOriginalIcon.code; // Mantém o código original
      finalIconDefinition = {
        ...fileGlyph, // Usa file/name de 'files', mas garante code/svg do original
        code: code,
        svg: glyphContent,
      };
    } else {
      // --- Novo ícone ou ícone antigo sem SVG no JSON: Lê o SVG do disco e atribui um novo código ---
      try {
        glyphContent = fs.readFileSync(
          path.join(inputDir, fileGlyph.file),
          'utf8'
        );
        code = currentCodeOffset.toString(16).toUpperCase();
        currentCodeOffset++; // Incrementa para o próximo novo ícone

        finalIconDefinition = {
          ...fileGlyph, // Usa file/name de 'files'
          code: code,
          svg: glyphContent,
        };
      } catch (error) {
        console.error(
          `Erro ao ler o arquivo SVG ${fileGlyph.file} para o ícone ${fileGlyph.name}:`,
          error
        );
        continue; // Pula este ícone se não puder ser lido
      }
    }

    // Se não obtivemos conteúdo SVG por algum motivo, pula
    if (!glyphContent) {
      console.warn(
        `Ícone ${fileGlyph.name} não pôde ser processado (sem conteúdo SVG).`
      );
      continue;
    }

    // Cria a stream em memória para este glifo
    const glyphStream = new Readable();
    glyphStream.push(glyphContent);
    glyphStream.push(null);

    (glyphStream as any).metadata = {
      unicode: [String.fromCharCode(parseInt(code, 16))],
      name: fileGlyph.name,
    };

    fontStream.write(glyphStream);

    // Adiciona ao mapeamento final
    finalMapping.push(finalIconDefinition);
    processedNames.add(fileGlyph.name); // Marca como processado
  }

  fontStream.end();

  await new Promise<void>((resolve, reject) => {
    fontStream.on('finish', () => resolve());
    fontStream.on('error', (err: any) => reject(err));
  });

  // A ordenação final é importante para a consistência do JSON
  finalMapping.sort((a, b) => parseInt(a.code, 16) - parseInt(b.code, 16));

  return { svgFont: svgBuffer, mapping: finalMapping };
}
