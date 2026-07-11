import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import { useBattleMapView } from '../state/useBattleMapView'
import { TokenMesh } from './TokenMesh'

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>

const TOKEN: TokenRenderState = {
  id: 'token-1',
  label: 'Token One',
  cell: { column: 10, row: 12 },
  elevation: 0,
  color: '#37ff78',
  visible: true,
}

type CaptureTarget = Readonly<{
  setPointerCapture: ReturnType<typeof vi.fn>
  releasePointerCapture: ReturnType<typeof vi.fn>
}>

function pointerEvent(target: CaptureTarget): Record<string, unknown> {
  return {
    nativeEvent: { stopImmediatePropagation: vi.fn() },
    pointerId: 7,
    target,
  }
}

async function startDrag(
  renderer: Renderer,
  target: CaptureTarget,
): Promise<ReturnType<Renderer['scene']['findByProps']>> {
  const mesh = renderer.scene.findByProps({ name: `token-${TOKEN.id}` })
  await renderer.fireEvent(mesh, 'pointerDown', pointerEvent(target))
  useBattleMapView.getState().previewTokenMove(TOKEN.id, { column: 13, row: 12 })
  return mesh
}

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it.each(['pointerCancel', 'lostPointerCapture'])('%s clears a drag without emitting intent', async (eventName) => {
  const onMoveIntent = vi.fn<(intent: MoveIntent) => void>()
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
  const renderer = await ReactThreeTestRenderer.create(
    <TokenMesh token={TOKEN} onMoveIntent={onMoveIntent} />,
  )
  const mesh = await startDrag(renderer, target)

  await renderer.fireEvent(mesh, eventName, pointerEvent(target))
  await renderer.fireEvent(mesh, 'pointerUp', pointerEvent(target))

  expect(useBattleMapView.getState().dragPreview).toBeNull()
  expect(onMoveIntent).not.toHaveBeenCalled()
  await renderer.unmount()
})

it('unmount clears a drag and releases capture without emitting intent', async () => {
  const onMoveIntent = vi.fn<(intent: MoveIntent) => void>()
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
  const renderer = await ReactThreeTestRenderer.create(
    <TokenMesh token={TOKEN} onMoveIntent={onMoveIntent} />,
  )
  await startDrag(renderer, target)

  await renderer.unmount()

  expect(useBattleMapView.getState().dragPreview).toBeNull()
  expect(target.releasePointerCapture).toHaveBeenCalledOnce()
  expect(onMoveIntent).not.toHaveBeenCalled()
})

it('emits no duplicate intent when pointer-up repeats after release', async () => {
  const onMoveIntent = vi.fn<(intent: MoveIntent) => void>()
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
  const renderer = await ReactThreeTestRenderer.create(
    <TokenMesh token={TOKEN} onMoveIntent={onMoveIntent} />,
  )
  const mesh = await startDrag(renderer, target)

  await renderer.fireEvent(mesh, 'pointerUp', pointerEvent(target))
  await renderer.fireEvent(mesh, 'pointerUp', pointerEvent(target))

  expect(onMoveIntent).toHaveBeenCalledOnce()
  expect(onMoveIntent).toHaveBeenCalledWith({
    tokenId: TOKEN.id,
    from: TOKEN.cell,
    to: { column: 13, row: 12 },
    path: [
      { column: 10, row: 12 },
      { column: 11, row: 12 },
      { column: 12, row: 12 },
      { column: 13, row: 12 },
    ],
  })
  await renderer.unmount()
})
