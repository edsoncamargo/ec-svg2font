// types.ts

import fs from 'fs';

export interface GenerateOptions {
  inputDir?: string;
  outputDir?: string;
  fontName: string;
  startCode?: number;
  exportTypes?: string[];
}

export interface GlyphStream extends fs.ReadStream {
  metadata?: {
    unicode: string[];
    name: string;
  };
}

export interface FileGlyph {
  file: string;
  name: string;
  code?: string;
}

// Interface que adiciona o campo SVG, herdando de FileGlyph
export interface IconDefinition extends FileGlyph {
  svg?: string; // Propriedade opcional para o conteúdo SVG
  code: string; // Garante que o código sempre esteja presente no mapeamento final
}

// Não usaremos GlyphWithContent, pois IconDefinition já será suficiente
