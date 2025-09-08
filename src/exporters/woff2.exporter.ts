import { FontExporter } from './font.exporter';
import fs from 'fs';
import path from 'path';
import svg2ttf from 'svg2ttf';
import ttf2woff2 from 'ttf2woff2';

export class WOFF2Exporter implements FontExporter {
  async export(
    fontName: string,
    outputDir: string | undefined,
    svgFont: string
  ) {
    const ttf = svg2ttf(svgFont, {});
    const woff2 = ttf2woff2(ttf.buffer);
    if (outputDir)
      fs.writeFileSync(
        path.join(outputDir, `${fontName}.woff2`),
        Buffer.from(woff2)
      );
  }
}
