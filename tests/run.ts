import { FontGenerator } from './../src/font-generator';

async function main() {
  await new FontGenerator()
    .setInputDir('./tests/input')
    .setOutputDir('./tests/output')
    .setFontName('icons')
    .setStartCode(0xe000)
    .setExportTypes(['ttf', 'woff', 'woff2', 'css', 'json', 'html'])
    .build();

  console.log('✅ Teste concluído');
}

main().catch(console.error);
