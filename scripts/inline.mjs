// Genera dist/simulador-keepdata.html: una sola página con el JavaScript incluido (para abrirla sin servidor).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const tag = /<script type="module" src="([^"]+)"><\/script>/;
const m = html.match(tag);
if (!m) throw new Error('No se encontró el script del simulador en dist/index.html');
const js = readFileSync('dist' + m[1], 'utf8').replace(/<\/script>/g, '<\\/script>');
writeFileSync('dist/simulador-keepdata.html', html.replace(tag, () => `<script type="module">${js}</script>`));
console.log('Listo: dist/simulador-keepdata.html');
