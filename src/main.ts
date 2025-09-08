import { FileGlyph, IconDefinition } from './types';

import { ExporterFactory } from './factories/exporter.factory';
import fs from 'fs';
import { generateSVGFont } from './utils/glyph.helper';
import { not } from './utils/boolean.utils';
import path from 'path';

export class FontGenerator {
  private inputDir!: string;
  private outputDir: string = path.resolve('./output');
  private fontName!: string;
  private startCode: number = 0xe000;
  private exportTypes: string[] = [
    'ttf',
    'woff',
    'woff2',
    'css',
    'json',
    'html',
  ];

  private existingMapping: IconDefinition[] = [];
  private filteredMapping: IconDefinition[] = [];
  private newFiles: string[] = [];
  private glyphsForStream: FileGlyph[] = [];

  constructor() {}

  setInputDir(dir: string) {
    this.inputDir = dir;
    return this;
  }

  setOutputDir(dir: string) {
    this.outputDir = dir;
    return this;
  }

  setFontName(name: string) {
    this.fontName = name;
    return this;
  }

  setStartCode(code: number) {
    this.startCode = code;
    return this;
  }

  setExportTypes(types: string[]) {
    this.exportTypes = types;
    return this;
  }

  private ensureOutputDir() {
    if (not(this.inputDir) || not(this.outputDir))
      throw new Error('Input/Output dir not set');
    if (not(fs.existsSync(this.outputDir)))
      fs.mkdirSync(this.outputDir, { recursive: true });
  }

  private loadExistingMapping() {
    const jsonPath = path.join(this.outputDir, `${this.fontName}.json`);
    this.existingMapping = fs.existsSync(jsonPath)
      ? JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      : [];
    this.filteredMapping = this.existingMapping.filter((m) =>
      fs.existsSync(path.join(this.inputDir, `${m.name}.svg`))
    );
  }

  private scanFiles() {
    const allFiles = fs
      .readdirSync(this.inputDir)
      .filter((f) => f.endsWith('.svg'));
    this.newFiles = allFiles.filter(
      (f) =>
        !this.filteredMapping.find((m) => m.name === path.basename(f, '.svg'))
    );

    const oldGlyphs: FileGlyph[] = this.filteredMapping.map((m) => ({
      file: `${m.name}.svg`,
      name: m.name,
      code: m.code,
    }));

    const newGlyphs: FileGlyph[] = this.newFiles.map((f) => ({
      file: f,
      name: path.basename(f, '.svg'),
    }));

    this.glyphsForStream = [...oldGlyphs, ...newGlyphs];
  }

  private getNextStartCode() {
    return this.filteredMapping.length
      ? parseInt(
          this.filteredMapping[this.filteredMapping.length - 1].code,
          16
        ) + 1
      : this.startCode;
  }

  private async generateSVGFont() {
    const startCodeForNew = this.getNextStartCode();
    const { svgFont, mapping } = await generateSVGFont({
      inputDir: this.inputDir,
      fontName: this.fontName,
      outputDir: this.outputDir,
      startCode: startCodeForNew,
      files: this.glyphsForStream,
    });
    return { svgFont, mapping };
  }

  private async exportFonts(svgFont: string, mapping: IconDefinition[]) {
    const exporters = ExporterFactory.create(this.exportTypes);
    for (const exporter of exporters) {
      await exporter.export(this.fontName, this.outputDir, svgFont, mapping);
    }
  }

  async build() {
    this.ensureOutputDir();
    this.loadExistingMapping();
    this.scanFiles();

    const { svgFont, mapping } = await this.generateSVGFont();
    await this.exportFonts(svgFont, mapping);

    console.log(`✅ Fontes geradas em ${this.outputDir}`);
  }
}
