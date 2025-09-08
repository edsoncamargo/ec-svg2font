import { FontExporter } from './font.exporter';
import { IconDefinition } from '../types';
import fs from 'fs';
import path from 'path';

const PREFIX = 'brad-icon';

export class CSSExporter implements FontExporter {
  async export(
    fontName: string,
    outputDir: string | undefined,
    _: string,
    mapping: IconDefinition[]
  ) {
    const applyIconsCss = /* CSS */ `@font-face {
  font-family: 'icons';
  src:  url('./icons.eot');
  src:  url('./icons.eot') format('embedded-opentype'),
  url('./icons.ttf') format('truetype'),
  url('./icons.woff') format('woff'),
  url('./icons.svg') format('svg');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

[class^="brad-icon-"], [class*=" brad-icon-"] {
  font-family: 'icons' !important;
  speak: never;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;

  /* Better Font Rendering =========== */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
    `;

    const classesCss = mapping
      .map(
        (m) =>
          `.${PREFIX}-${m.name}::before { content: "\\${m.code}"; font-family: "${fontName}"; }`
      )
      .join('\n');

    if (outputDir)
      fs.writeFileSync(
        path.join(outputDir, `${fontName}.css`),
        [applyIconsCss, classesCss].join('\n')
      );
  }
}
