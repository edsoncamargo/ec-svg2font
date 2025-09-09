// font-generator.ts

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
  private startCode: number = 0xe000; // Código inicial para novos ícones
  private exportTypes: string[] = [
    'ttf',
    'woff',
    'woff2',
    'css',
    'json',
    'html',
  ];

  private existingMapping: IconDefinition[] = [];
  private finalMapping: IconDefinition[] = [];
  private validExistingIcons: FileGlyph[] = [];
  private removedIconsFromMapping: IconDefinition[] = [];
  private newFileIcons: FileGlyph[] = [];

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
    if (fs.existsSync(jsonPath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (Array.isArray(existingData)) {
          this.existingMapping = existingData
            .filter(
              (item: any) =>
                item &&
                typeof item.name === 'string' &&
                typeof item.code === 'string'
            )
            .map((item: any) => ({
              file: item.file || `${item.name}.svg`,
              name: item.name,
              code: item.code,
              // 🔑 preserva o svg se já existir no JSON
              svg: item.svg || undefined,
            }));
        }
      } catch (e) {
        console.error(
          'Erro ao carregar o mapeamento JSON existente, iniciando com mapeamento vazio.',
          e
        );
        this.existingMapping = [];
      }
    } else {
      this.existingMapping = [];
    }
  }

  private scanFiles() {
    const allSvgFiles = fs
      .readdirSync(this.inputDir)
      .filter((f) => f.endsWith('.svg'));
    const allFileNames = allSvgFiles.map((f) => path.basename(f));

    this.validExistingIcons = this.existingMapping
      .filter((m) => allFileNames.includes(m.file))
      .map((m) => ({ file: m.file, name: m.name, code: m.code }));

    this.removedIconsFromMapping = this.existingMapping.filter(
      (m) => !allFileNames.includes(m.file)
    );

    this.newFileIcons = allSvgFiles
      .filter(
        (fileName) =>
          !this.existingMapping.some(
            (mappedItem) => mappedItem.file === fileName
          )
      )
      .map((f) => ({ file: f, name: path.basename(f, '.svg') }));
  }

  private getNextStartCode() {
    let maxCode = this.startCode;
    this.existingMapping.forEach((icon) => {
      if (icon.code) {
        const codeInt = parseInt(icon.code, 16);
        if (codeInt >= maxCode) {
          maxCode = codeInt + 1;
        }
      }
    });
    return maxCode;
  }

  private async generateSVGFont() {
    const startCodeForNew = this.getNextStartCode();

    const glyphsToProcessCombined = [
      ...this.validExistingIcons,
      ...this.newFileIcons,
    ];

    const { svgFont, mapping } = await generateSVGFont({
      inputDir: this.inputDir,
      fontName: this.fontName,
      outputDir: this.outputDir,
      startCode: startCodeForNew,
      files: glyphsToProcessCombined,
      existingMapping: this.existingMapping,
    });

    this.finalMapping = mapping;
    return { svgFont, mapping: this.finalMapping };
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

    if (this.validExistingIcons.length > 0 || this.newFileIcons.length > 0) {
      const { svgFont, mapping } = await this.generateSVGFont();
      this.finalMapping = mapping;
      await this.exportFonts(svgFont, this.finalMapping);
    } else {
      console.log(
        'Nenhum ícone novo ou modificado encontrado. Preservando ícones existentes do JSON.'
      );
      this.finalMapping = this.existingMapping;

      const exporters = ExporterFactory.create(['json', 'html']);
      for (const exporter of exporters) {
        await exporter.export(
          this.fontName,
          this.outputDir,
          '',
          this.finalMapping
        );
      }
    }

    console.log(`✅ Fontes geradas em ${this.outputDir}`);
  }
}
