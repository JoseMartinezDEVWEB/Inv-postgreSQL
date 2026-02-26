import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, '../build/icon.png');
const outputPath = path.join(__dirname, '../build/icon.ico');

console.log('🎨 Convirtiendo PNG a ICO...');
console.log('📁 Input:', inputPath);
console.log('📁 Output:', outputPath);

pngToIco(inputPath)
    .then(buf => {
        fs.writeFileSync(outputPath, buf);
        console.log('✅ Icono ICO creado exitosamente!');
    })
    .catch(err => {
        console.error('❌ Error al convertir:', err);
        process.exit(1);
    });
