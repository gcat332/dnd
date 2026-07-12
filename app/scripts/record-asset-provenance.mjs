import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const appRoot = path.resolve(new URL('..', import.meta.url).pathname);
const dateArg = process.argv.find((argument) => argument.startsWith('--download-date='));
const downloadDate = dateArg?.slice('--download-date='.length);
if (!downloadDate || !/^\d{4}-\d{2}-\d{2}$/.test(downloadDate)) {
  throw new Error('Usage: npm run assets:provenance -- --download-date=YYYY-MM-DD');
}
const parsedDate = new Date(`${downloadDate}T00:00:00Z`);
if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== downloadDate) {
  throw new Error(`Invalid download date: ${downloadDate}`);
}

const sources = [
  ['kaykit-adventurers-free-2.0', 'https://kaylousberg.itch.io/kaykit-adventurers', '2.0', 'adventurers-free-2.0.zip', 'adventurers-free-2.0/KayKit_Adventurers_2.0_FREE/License.txt'],
  ['kaykit-skeletons-free-1.1', 'https://kaylousberg.itch.io/kaykit-skeletons', '1.1', 'skeletons-free-1.1.zip', 'skeletons-free-1.1/KayKit_Skeletons_1.1_FREE/License.txt'],
  ['kaykit-character-animations-free-1.1', 'https://kaylousberg.itch.io/kaykit-character-animations', '1.1', 'character-animations-free-1.1.zip', 'character-animations-free-1.1/KayKit_Character_Animations_1.1/License.txt'],
];

async function record([sourceId, officialUrl, advertisedVersion, archiveName, licenseRelativePath]) {
  const archivePath = path.join(appRoot, '.asset-workbench', 'kaykit', 'archives', archiveName);
  const bytes = await readFile(archivePath).catch(() => {
    throw new Error(`Missing source archive: ${archivePath}`);
  });
  const hash = createHash('sha256').update(bytes).digest('hex');
  const { size } = await stat(archivePath);
  const licensePath = path.join(appRoot, '.asset-workbench', 'kaykit', 'extracted', licenseRelativePath);
  await access(licensePath).catch(() => { throw new Error(`Missing extracted licence file: ${licensePath}`); });
  return { sourceId, officialUrl, advertisedVersion, downloadDate, archiveFilename: archiveName, byteSize: size, sha256: hash };
}

const output = path.join(appRoot, 'asset-records', 'characters', 'kaykit-source-provenance.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ schemaVersion: 1, sources: await Promise.all(sources.map(record)) }, null, 2)}\n`);
console.log(`Recorded ${sources.length} KayKit source archive hashes in ${path.relative(appRoot, output)}.`);
