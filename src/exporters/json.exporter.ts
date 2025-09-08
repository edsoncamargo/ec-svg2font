import { FontExporter } from './font.exporter';
import { IconDefinition } from '../types';
import fs from 'fs';
import path from 'path';

export class JSONExporter implements FontExporter {
  async export(
    fontName: string,
    outputDir: string | undefined,
    svgFont: string,
    mapping: IconDefinition[]
  ) {
    if (outputDir)
      fs.writeFileSync(
        path.join(outputDir, `${fontName}.json`),
        JSON.stringify(mapping, null, 2)
      );
  }
}
