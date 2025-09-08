export interface IconDefinition {
  name: string;
  code: string;
}

export interface GenerateOptions {
  inputDir?: string;
  outputDir?: string;
  fontName: string;
  startCode?: number;
  exportTypes?: string[];
}

import fs from 'fs';

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
