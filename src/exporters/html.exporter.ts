import { FontExporter } from './font.exporter';
import { IconDefinition } from '../types';
import fs from 'fs';
import { not } from '../utils/boolean.utils';
import path from 'path';

export class HTMLExporter implements FontExporter {
  async export(
    fontName: string,
    outputDir: string | undefined,
    _: string,
    mapping: IconDefinition[]
  ) {
    if (not(outputDir)) return;

    const demoHtml = /* HTML */ `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Demo ${fontName}</title>
          <link rel="stylesheet" href="./${fontName}.css" />
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            .icon {
              font-size: 40px;
              margin: 10px;
              display: inline-block;
              text-align: center;
            }
            .icon-name {
              display: block;
              font-size: 14px;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <h1>Demo de ícones - ${fontName}</h1>
          <div>
            ${mapping
              .map(
                (m) =>
                  `<div class="icon"><span class="brad-icon-${m.name}"></span><span class="icon-name">${m.name}</span></div>`
              )
              .join('\n')}
          </div>
        </body>
      </html>
    `;

    fs.writeFileSync(path.join(outputDir, 'demo.html'), demoHtml, 'utf-8');
  }
}
