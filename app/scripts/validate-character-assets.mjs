import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';

const appRoot = path.resolve(new URL('..', import.meta.url).pathname);
const assetRoot = path.join(appRoot, 'public/assets/characters');
const manifest = JSON.parse(await readFile(path.join(assetRoot, 'asset-manifest.json'), 'utf8'));
const io = new NodeIO();
const clips = new Set(['idle', 'move', 'attack', 'hit', 'death']);
const sockets = ['socket_main_hand', 'socket_off_hand', 'socket_back', 'socket_head'];
const failures = [];
const pass = (id, details) => console.log(`PASS ${id.padEnd(18)} ${details}`);
const fail = (id, details) => failures.push(`FAIL ${id}: ${details}`);

function finiteAccessor(accessor) {
  const array = accessor.getArray();
  return !array || Array.from(array).every(Number.isFinite);
}

async function auditCharacter(record) {
  const filename = path.join(assetRoot, record.url.replace('/assets/characters/', ''));
  const bytes = (await stat(filename)).size;
  const document = await io.read(filename);
  const root = document.getRoot();
  const names = new Set(root.listAnimations().map((animation) => animation.getName()));
  const missingClips = [...clips].filter((name) => !names.has(name));
  const missingSockets = sockets.filter((name) => !root.listNodes().some((node) => node.getName() === name));
  const triangles = root.listMeshes().reduce((total, mesh) => total + mesh.listPrimitives().reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  const materials = new Set(root.listMeshes().flatMap((mesh) => mesh.listPrimitives().map((primitive) => primitive.getMaterial()?.getName())));
  const skins = root.listSkins();
  const maxBones = skins.reduce((max, skin) => Math.max(max, skin.listJoints().length), 0);
  const validAccessors = root.listAccessors().every(finiteAccessor);
  const maxTexture = root.listTextures().reduce((max, texture) => Math.max(max, ...(texture.getSize() ?? [0, 0])), 0);
  const roleLimit = record.role === 'monster' ? 8000 : 12000;
  const byteLimit = record.role === 'monster' ? 1_000_000 : 1_500_000;
  const problems = [
    missingClips.length && `missing clips ${missingClips.join(',')}`,
    missingSockets.length && `missing sockets ${missingSockets.join(',')}`,
    triangles > roleLimit && `${Math.round(triangles)} triangles > ${roleLimit}`,
    root.listMeshes().length > 2 && `${root.listMeshes().length} skinned meshes > 2`,
    materials.size > 2 && `${materials.size} materials > 2`,
    maxBones > (record.role === 'monster' ? 50 : 60) && `${maxBones} bones over limit`,
    bytes > byteLimit && `${bytes} bytes > ${byteLimit}`,
    maxTexture > 512 && `texture ${maxTexture}px > 512px`,
    !validAccessors && 'non-finite accessor values',
  ].filter(Boolean);
  if (problems.length) fail(record.id, problems.join('; '));
  else pass(record.id, `${Math.round(triangles)} triangles, ${bytes} bytes, ${names.size} clips, ${skins.length} skin`);
}

async function auditEquipment(record) {
  const filename = path.join(assetRoot, record.url.replace('/assets/characters/', ''));
  const bytes = (await stat(filename)).size;
  const document = await io.read(filename);
  const root = document.getRoot();
  const problems = [];
  if (root.listSkins().length) problems.push('must be static');
  if (root.listAnimations().length) problems.push('must not contain animations');
  const materials = new Set(root.listMeshes().flatMap((mesh) => mesh.listPrimitives().map((primitive) => primitive.getMaterial()?.getName())));
  if (materials.size > 1) problems.push(`${materials.size} materials > 1`);
  if (root.listAccessors().some((accessor) => !finiteAccessor(accessor))) problems.push('non-finite accessor values');
  if (problems.length) fail(record.id, problems.join('; '));
  else pass(record.id, `${bytes} bytes, static, ${materials.size} material`);
}

if (manifest.schemaVersion !== 1 || manifest.characters.length !== 3 || manifest.equipment.length !== 6) {
  throw new Error('Character asset manifest must contain schemaVersion 1, 3 characters, and 6 equipment records');
}
for (const record of manifest.characters) await auditCharacter(record);
for (const record of manifest.equipment) await auditEquipment(record);
const characterBytes = await Promise.all(manifest.characters.map(async (record) => (await stat(path.join(assetRoot, record.url.replace('/assets/characters/', '')))).size));
if (characterBytes.reduce((sum, value) => sum + value, 0) > 4_000_000) fail('character-slice', 'character GLBs exceed 4 MB total');
else pass('character-slice', `${characterBytes.reduce((sum, value) => sum + value, 0)} bytes total`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
