import { CSSExporter } from '../exporters/css.exporter';
import { FontExporter } from '../exporters/font.exporter';
import { HTMLExporter } from '../exporters/html.exporter';
import { JSONExporter } from '../exporters/json.exporter';
import { TTFExporter } from './../exporters/ttf.exporter';
import { WOFF2Exporter } from './../exporters/woff2.exporter';
import { WOFFExporter } from './../exporters/woff.exporter';

export class ExporterFactory {
  static create(types: string[]): FontExporter[] {
    console.log(types);

    return types.map((type) => {
      switch (type) {
        case 'ttf':
          return new TTFExporter();
        case 'woff':
          return new WOFFExporter();
        case 'woff2':
          return new WOFF2Exporter();
        case 'css':
          return new CSSExporter();
        case 'json':
          return new JSONExporter();
        case 'html':
          return new HTMLExporter();
        default:
          throw new Error(`Formato não suportado: ${type}`);
      }
    });
  }
}
