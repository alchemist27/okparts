const sharp = require('sharp');
const fs = require('fs');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#3b82f6" rx="64"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="220" font-weight="bold" text-anchor="middle" fill="white">OK</text>
</svg>
`;

async function generateIcons() {
  const buffer = Buffer.from(svg);

  // 192x192
  await sharp(buffer)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');

  // 512x512
  await sharp(buffer)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');

  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
