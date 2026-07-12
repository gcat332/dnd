import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO, Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { copyToDocument, createDefaultPropertyResolver, joinPrimitives, prune, textureCompress, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const workbench = path.join(root, '.asset-workbench', 'kaykit', 'extracted');
const output = path.join(root, 'public', 'assets', 'characters');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const paths = {
  adventurers: path.join(workbench, 'adventurers-free-2.0', 'KayKit_Adventurers_2.0_FREE'),
  skeletons: path.join(workbench, 'skeletons-free-1.1', 'KayKit_Skeletons_1.1_FREE'),
  animations: path.join(workbench, 'character-animations-free-1.1', 'KayKit_Character_Animations_1.1', 'Animations', 'gltf', 'Rig_Medium'),
};

const characters = [
  {
    id: 'kaykit-knight',
    source: path.join(paths.adventurers, 'Characters', 'gltf', 'Knight.glb'),
    clips: [
      ['Melee_2H_Idle', 'idle', 'Rig_Medium_CombatMelee.glb'],
      ['Walking_A', 'move', 'Rig_Medium_MovementBasic.glb'],
      ['Melee_1H_Attack_Slice_Horizontal', 'attack', 'Rig_Medium_CombatMelee.glb'],
      ['Hit_A', 'hit', 'Rig_Medium_General.glb'],
      ['Death_A', 'death', 'Rig_Medium_General.glb'],
    ],
  },
  {
    id: 'kaykit-mage',
    source: path.join(paths.adventurers, 'Characters', 'gltf', 'Mage.glb'),
    clips: [
      ['Ranged_Magic_Spellcasting', 'idle', 'Rig_Medium_CombatRanged.glb'],
      ['Walking_A', 'move', 'Rig_Medium_MovementBasic.glb'],
      ['Ranged_Magic_Shoot', 'attack', 'Rig_Medium_CombatRanged.glb'],
      ['Hit_A', 'hit', 'Rig_Medium_General.glb'],
      ['Death_A', 'death', 'Rig_Medium_General.glb'],
    ],
  },
  {
    id: 'kaykit-skeleton',
    source: path.join(paths.skeletons, 'characters', 'gltf', 'Skeleton_Warrior.glb'),
    clips: [
      ['Skeletons_Idle', 'idle', 'Rig_Medium_Special.glb'],
      ['Skeletons_Walking', 'move', 'Rig_Medium_Special.glb'],
      ['Melee_1H_Attack_Chop', 'attack', 'Rig_Medium_CombatMelee.glb'],
      ['Hit_A', 'hit', 'Rig_Medium_General.glb'],
      ['Skeletons_Death', 'death', 'Rig_Medium_Special.glb'],
    ],
  },
];

function nodeMap(document) {
  return new Map(document.getRoot().listNodes().map((node) => [node.getName(), node]));
}

async function copyClip(target, clipName, runtimeName, sourceFile) {
  const source = await io.read(sourceFile);
  const sourceClip = source.getRoot().listAnimations().find((animation) => animation.getName() === clipName);
  if (!sourceClip) throw new Error(`Missing source clip ${clipName} in ${sourceFile}`);
  const targets = nodeMap(target);
  const resolver = createDefaultPropertyResolver(target, source);
  const copied = copyToDocument(target, source, [sourceClip], (property) => {
    if (property instanceof Node && targets.has(property.getName())) return targets.get(property.getName());
    return resolver(property);
  });
  const result = copied.get(sourceClip);
  if (!result) throw new Error(`Could not copy source clip ${clipName}`);
  result.setName(runtimeName);
}

function addSockets(document) {
  const nodes = nodeMap(document);
  const parents = {
    socket_main_hand: 'hand.r',
    socket_off_hand: 'hand.l',
    socket_back: 'chest',
    socket_head: 'head',
  };
  for (const [socket, parentName] of Object.entries(parents)) {
    if (nodes.has(socket)) continue;
    const parent = nodes.get(parentName);
    if (!parent) throw new Error(`Missing socket parent bone ${parentName}`);
    parent.addChild(document.createNode(socket));
  }
}

function collapseCharacterGeometry(document) {
  const meshNodes = document.getRoot().listNodes().filter((node) => node.getMesh());
  const groups = new Map();
  for (const node of meshNodes) {
    for (const primitive of node.getMesh().listPrimitives()) {
      const material = primitive.getMaterial();
      const key = `${material?.getName() ?? 'default'}|${primitive.listSemantics().join(',')}`;
      const group = groups.get(key) ?? { material, primitives: [], node };
      group.primitives.push(primitive);
      groups.set(key, group);
    }
    node.setMesh(null);
  }
  for (const { material, primitives, node } of groups.values()) {
    const mesh = document.createMesh(`character-${material?.getName() ?? 'default'}`);
    mesh.addPrimitive(primitives.length === 1 ? primitives[0] : joinPrimitives(primitives));
    node.setMesh(mesh);
  }
}

async function optimize(document) {
  await document.transform(textureCompress({ encoder: sharp, resize: [512, 512], targetFormat: 'png' }), unpartition(), prune({ keepLeaves: true }));
}

async function writeCharacter(character) {
  const document = await io.read(character.source);
  for (const [sourceName, runtimeName, sourceFile] of character.clips) {
    await copyClip(document, sourceName, runtimeName, path.join(paths.animations, sourceFile));
  }
  addSockets(document);
  collapseCharacterGeometry(document);
  await optimize(document);
  await io.write(path.join(output, `${character.id}.glb`), document);
}

async function writeEquipment(id, sourceFile) {
  const document = await io.read(sourceFile);
  await optimize(document);
  await io.write(path.join(output, 'equipment', `${id}.glb`), document);
}

async function writeHelmet() {
  const document = await io.read(path.join(paths.adventurers, 'Characters', 'gltf', 'Knight.glb'));
  const helmet = document.getRoot().listNodes().find((node) => node.getName() === 'Knight_Helmet');
  if (!helmet?.getMesh()) throw new Error('Knight helmet mesh not found');
  for (const node of document.getRoot().listNodes()) {
    if (node !== helmet) node.setMesh(null);
    node.setSkin(null);
  }
  for (const primitive of helmet.getMesh().listPrimitives()) {
    primitive.setAttribute('JOINTS_0', null);
    primitive.setAttribute('WEIGHTS_0', null);
  }
  await optimize(document);
  await io.write(path.join(output, 'equipment', 'helmet.glb'), document);
}

await mkdir(path.join(output, 'equipment'), { recursive: true });
for (const character of characters) await writeCharacter(character);
const equipmentRoot = path.join(paths.adventurers, 'Assets', 'gltf');
for (const [id, file] of Object.entries({
  sword: 'sword_1handed.gltf',
  shield: 'shield_round.gltf',
  staff: 'staff.gltf',
  wand: 'wand.gltf',
  axe: 'axe_1handed.gltf',
})) await writeEquipment(id, path.join(equipmentRoot, file));
await writeHelmet();

console.log('Normalized 3 characters and 6 equipment assets.');
