import fs from 'fs';
import path from 'path';
import svg2ttf from 'svg2ttf';
import ttf2eot from 'ttf2eot';

export class TTFExporter {
  async export(
    fontName: string,
    outputDir: string | undefined,
    svgFont: string
  ) {
    const ttf = svg2ttf(svgFont, {});
    const ttfBuffer = Buffer.from(ttf.buffer);
    const eot = ttf2eot(ttfBuffer).buffer;
    const eotBuffer = Buffer.from(eot);

    if (outputDir) {
      fs.writeFileSync(path.join(outputDir, `${fontName}.ttf`), ttfBuffer);
      fs.writeFileSync(path.join(outputDir, `${fontName}.eot`), eotBuffer);
    }
  }
}
