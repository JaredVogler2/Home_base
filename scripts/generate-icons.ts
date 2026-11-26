/**
 * Draws HOMEBASE's icons — the little house under a blue sky — and writes them as the files a phone and a
 * browser ask for. Run it again if the drawing changes:  npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

/** The house, on a 512 grid. `inset` shrinks it for a maskable icon, whose edges a phone may cut away. */
function house(inset: number, background: boolean): string {
  const scale = (512 - inset * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${background ? '<rect width="512" height="512" fill="#a9daf5"/><rect y="372" width="512" height="140" fill="#9fd98a"/>' : ''}
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <circle cx="398" cy="118" r="44" fill="#ffc94d"/>
    <rect x="322" y="132" width="44" height="92" rx="8" fill="#e98765"/>
    <rect x="312" y="118" width="64" height="26" rx="8" fill="#c9573a"/>
    <path d="M124 262 V420 Q124 436 140 436 H372 Q388 436 388 420 V262 L256 142 Z" fill="#fff6e6" stroke="#c9976b" stroke-width="12" stroke-linejoin="round"/>
    <path d="M84 276 L256 118 L428 276" fill="none" stroke="#f08a62" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 262 L256 118" fill="none" stroke="#ffd9c7" stroke-width="8" stroke-linecap="round" opacity="0.7"/>
    <rect x="216" y="318" width="80" height="118" rx="14" fill="#ffc94d" stroke="#e39a1c" stroke-width="8"/>
    <circle cx="278" cy="380" r="7" fill="#8d5b36"/>
    <rect x="152" y="290" width="48" height="48" rx="10" fill="#cdeeff" stroke="#c9976b" stroke-width="8"/>
    <rect x="312" y="290" width="48" height="48" rx="10" fill="#cdeeff" stroke="#c9976b" stroke-width="8"/>
  </g>
</svg>`;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', house(0, false).replace(' width="512" height="512"', ''));

const jobs: [string, number, number][] = [
  ['public/icons/icon-192.png', 192, 24],
  ['public/icons/icon-512.png', 512, 24],
  ['public/icons/maskable-512.png', 512, 78],
  ['public/icons/apple-touch-icon.png', 180, 20],
];
for (const [file, size, inset] of jobs) {
  await sharp(Buffer.from(house(inset, true)))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${file}`);
}
