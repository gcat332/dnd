import { MAP_SIZE_CELLS } from '../battle-map/domain/grid'

export const TERRAIN_KINDS = ['wall', 'platform', 'pillar'] as const
export type TerrainKind = (typeof TERRAIN_KINDS)[number]

export type TerrainFeature = {
  id: string
  kind: TerrainKind
  column: number
  row: number
  widthCells: number
  depthCells: number
  heightCells: number
}

export const MAX_TERRAIN_FEATURES = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isValidTerrainFeature(value: unknown): value is TerrainFeature {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || value.id.length === 0) return false
  if (!TERRAIN_KINDS.includes(value.kind as TerrainKind)) return false
  if (!isNonNegativeInt(value.column) || !isNonNegativeInt(value.row)) return false
  if (!isPositiveInt(value.widthCells) || !isPositiveInt(value.depthCells)) return false
  if (!isPositiveInt(value.heightCells)) return false
  if (value.column + value.widthCells > MAP_SIZE_CELLS) return false
  if (value.row + value.depthCells > MAP_SIZE_CELLS) return false
  return true
}

export function parseTerrainFeatures(value: unknown): TerrainFeature[] {
  if (!Array.isArray(value)) return []
  const features: TerrainFeature[] = []
  for (const candidate of value) {
    if (features.length >= MAX_TERRAIN_FEATURES) break
    if (isValidTerrainFeature(candidate)) features.push(candidate)
  }
  return features
}

export function terrainFeatureBox(feature: TerrainFeature): {
  position: [number, number, number]
  scale: [number, number, number]
} {
  return {
    position: [
      feature.column + feature.widthCells / 2,
      feature.heightCells / 2,
      feature.row + feature.depthCells / 2,
    ],
    scale: [feature.widthCells, feature.heightCells, feature.depthCells],
  }
}
