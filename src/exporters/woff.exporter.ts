import { FontExporter } from './font.exporter';
import fs from 'fs';
import path from 'path';
import svg2ttf from 'svg2ttf';
import ttf2woff from 'ttf2woff';

export class WOFFExporter implements FontExporter {
  async export(
    fontName: string,
    outputDir: string | undefined,
    svgFont: string
  ) {
    const ttf = svg2ttf(svgFont, {});
    const woff = ttf2woff(ttf.buffer);
    if (outputDir)
      fs.writeFileSync(
        path.join(outputDir, `${fontName}.woff`),
        Buffer.from(woff.buffer)
      );
  }
}
