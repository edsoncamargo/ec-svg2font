import { IconDefinition } from '../types';

export interface FontExporter {
  export(
    fontName: string,
    outputDir: string | undefined,
    svgFont: string,
    mapping: IconDefinition[]
  ): Promise<void>;
}
