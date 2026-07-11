import type { TokenRenderState } from '../domain/tokens'
import type { RemoteTokenAnimation } from '../scene/AnimatedToken'
import type { VisualLight } from '../scene/LightLayer'

export type StressInteractiveObject = TokenRenderState &
  Readonly<{ kind: 'token' | 'prop' }>

export type StressWall = Readonly<{
  id: string
  position: readonly [number, number, number]
  scale: readonly [number, number, number]
}>

export type StressScene = Readonly<{
  interactiveObjects: readonly StressInteractiveObject[]
  walls: readonly StressWall[]
  lights: readonly VisualLight[]
  fog: Readonly<{ active: true; color: string; near: number; far: number }>
  animations: readonly RemoteTokenAnimation[]
}>

const COLORS = ['#37ff78', '#ff4f81', '#57b8ff', '#f0ca4d', '#c58cff'] as const

export function createStressScene(nowMs = 0): StressScene {
  const interactiveObjects = Array.from({ length: 200 }, (_, index) => ({
    id: `stress-object-${index.toString().padStart(3, '0')}`,
    label: `${index < 100 ? 'Token' : 'Prop'} ${index + 1}`,
    kind: index < 100 ? ('token' as const) : ('prop' as const),
    cell: {
      column: 75 + (index % 20) * 2,
      row: 80 + Math.floor(index / 20) * 4,
    },
    elevation: index < 100 ? 0 : (index % 3) * 0.15,
    color: COLORS[index % COLORS.length]!,
    visible: true,
  }))

  return {
    interactiveObjects,
    walls: [
      { id: 'north-wall', position: [100, 1.5, 76], scale: [52, 3, 1] },
      { id: 'west-wall', position: [74, 1.5, 100], scale: [1, 3, 48] },
      { id: 'inner-wall', position: [105, 1.5, 99], scale: [18, 3, 1] },
    ],
    lights: [
      { id: 'stress-light-nw', cell: { column: 86, row: 88 }, elevation: 5, color: '#ffb35c', intensity: 22, range: 20 },
      { id: 'stress-light-ne', cell: { column: 112, row: 88 }, elevation: 5, color: '#79cfff', intensity: 22, range: 20 },
      { id: 'stress-light-sw', cell: { column: 86, row: 110 }, elevation: 5, color: '#ff7f9d', intensity: 22, range: 20 },
    ],
    fog: { active: true, color: '#171a1f', near: 90, far: 220 },
    animations: interactiveObjects.slice(0, 24).map((object, index) => ({
      tokenId: object.id,
      from: { column: object.cell.column - 1, row: object.cell.row },
      to: object.cell,
      eventStartMs: nowMs + (index % 4) * 120,
      durationMs: 1_600 + (index % 3) * 200,
    })),
  }
}
