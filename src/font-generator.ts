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

  // Mapeamento completo carregado do JSON
  private existingMapping: IconDefinition[] = [];
  // Mapeamento final a ser exportado
  private finalMapping: IconDefinition[] = [];
  // Ícones que existem no disco e já tinham mapeamento (mantêm seus códigos e posições)
  private validExistingIcons: FileGlyph[] = [];
  // Ícones que estavam no JSON mas foram removidos do disco (serão preservados no finalMapping)
  private removedIconsFromMapping: IconDefinition[] = [];
  // Novos ícones que não estavam no JSON
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
              // Não carregamos mais o SVG diretamente do JSON aqui,
              // a leitura do disco será feita em glyph.helper.ts
              svg: undefined, // Garantimos que não carregamos o SVG
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

    // 1. Ícones que estavam no JSON E ainda existem como arquivo .svg
    // Estes irao manter seus codigos originais e serao processados primeiro.
    this.validExistingIcons = this.existingMapping
      .filter((m) => allFileNames.includes(m.file))
      .map((m) => ({ file: m.file, name: m.name, code: m.code })); // Mantém o code original

    // 2. Ícones que estavam no JSON, mas o arquivo .svg NÃO existe mais no disco.
    // Estes serão PRESERVADOS no mapeamento final.
    this.removedIconsFromMapping = this.existingMapping.filter(
      (m) => !allFileNames.includes(m.file)
    );

    // 3. Novos ícones: arquivos .svg no disco que NÃO estavam no mapeamento existente.
    this.newFileIcons = allSvgFiles
      .filter(
        (fileName) =>
          !this.existingMapping.some(
            (mappedItem) => mappedItem.file === fileName
          )
      )
      .map((f) => ({ file: f, name: path.basename(f, '.svg') })); // Novos ícones não têm code aqui
  }

  private getNextStartCode() {
    let maxCode = this.startCode;
    // Procura o maior código hexadecimal em todo o mapeamento existente (incluindo os removidos)
    // para garantir que novos códigos sequenciais não o sobrescrevam.
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

    // A lista de ícones a serem processados agora inclui:
    // 1. Ícones existentes válidos (mantendo seus códigos originais).
    // 2. Novos ícones (que receberão novos códigos).
    const glyphsToProcessCombined = [
      ...this.validExistingIcons,
      ...this.newFileIcons,
    ];

    // A função generateSVGFont é responsável por processar 'glyphsToProcessCombined',
    // preservar códigos originais, atribuir novos códigos, e
    // DEVOLVER um mapeamento que JÁ INCLUI os ícones removidos.
    const { svgFont, mapping } = await generateSVGFont({
      inputDir: this.inputDir,
      fontName: this.fontName,
      outputDir: this.outputDir,
      startCode: startCodeForNew, // Usado apenas para atribuir códigos a NEW ícones.
      files: glyphsToProcessCombined, // Passa a lista combinada de ícones
      existingMapping: this.existingMapping, // Passa o mapeamento completo para preserve os removidos
    });

    // O 'mapping' retornado por generateSVGFont é o mapeamento FINAL completo.
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

    // Verifica se há ícones novos OU ícones existentes válidos que precisam ser processados
    // para a fonte. Se não houver, o processo de geração de fonte é pulado.
    if (this.validExistingIcons.length > 0 || this.newFileIcons.length > 0) {
      const { svgFont, mapping } = await this.generateSVGFont();
      this.finalMapping = mapping; // O mapping retornado já é o final completo
      await this.exportFonts(svgFont, this.finalMapping);
    } else {
      // Caso não haja ícones novos ou modificados nos arquivos SVG,
      // apenas preservamos o mapeamento existente (que inclui os removidos).
      console.log(
        'Nenhum ícone novo ou modificado encontrado. Preservando ícones existentes do JSON.'
      );
      this.finalMapping = this.existingMapping;

      // Exporta apenas o JSON e HTML se não houver alterações nas fontes
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
