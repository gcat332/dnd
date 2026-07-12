import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TokenRenderState } from '../domain/tokens'
import { useBattleMapView } from '../state/useBattleMapView'
import { TokenLayer } from './TokenLayer'

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>

const TOKEN: TokenRenderState = {
  id: 'token-1',
  label: 'Token One',
  cell: { column: 10, row: 12 },
  elevation: 0,
  color: '#37ff78',
  visible: true,
}

const CHARACTER_TOKEN: TokenRenderState = {
  ...TOKEN,
  id: 'character-1',
  character: {
    recipeId: 'kaykit-knight',
    animation: 'idle',
    facingRadians: 0,
    equipment: { mainHand: 'sword', offHand: 'shield', back: null, head: null },
  },
}

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

async function beginDrag(renderer: Renderer) {
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
  const mesh = renderer.scene.findByProps({ name: `token-${TOKEN.id}` })
  await renderer.fireEvent(mesh, 'pointerDown', {
    nativeEvent: { stopImmediatePropagation: vi.fn() },
    pointerId: 7,
    target,
  })
  useBattleMapView.getState().previewTokenMove(TOKEN.id, { column: 13, row: 12 })
  return target
}

it('keeps shared geometry ownership narrow and per-token material disposable', async () => {
  useBattleMapView.getState().previewTokenMove(TOKEN.id, { column: 11, row: 12 })
  const renderer = await ReactThreeTestRenderer.create(
    <TokenLayer tokens={[TOKEN]} onMoveIntent={vi.fn()} />,
  )

  expect(renderer.scene.findByProps({ name: 'token-layer' }).props.dispose).toBeUndefined()
  expect(renderer.scene.findByProps({ name: 'movement-preview' }).props.dispose).toBeUndefined()
  const geometry = renderer.scene.findByType('CylinderGeometry')
  const material = renderer.scene.findByType('MeshStandardMaterial')
  const previewGeometry = renderer.scene.findAllByType('BoxGeometry')[0]!
  const previewMaterial = renderer.scene.findAllByType('MeshBasicMaterial')[0]!
  expect(geometry.props.dispose).toBeNull()
  expect(material.props.dispose).toBeUndefined()
  expect(previewGeometry.props.dispose).toBeNull()
  expect(previewMaterial.props.dispose).toBeNull()
  const disposeGeometry = vi.spyOn(
    geometry.instance as unknown as { dispose: () => void },
    'dispose',
  )
  const disposeMaterial = vi.spyOn(
    material.instance as unknown as { dispose: () => void },
    'dispose',
  )
  const disposePreviewGeometry = vi.spyOn(
    previewGeometry.instance as unknown as { dispose: () => void },
    'dispose',
  )
  const disposePreviewMaterial = vi.spyOn(
    previewMaterial.instance as unknown as { dispose: () => void },
    'dispose',
  )
  await renderer.unmount()
  expect(disposeGeometry).not.toHaveBeenCalled()
  expect(disposeMaterial).toHaveBeenCalledOnce()
  expect(disposePreviewGeometry).not.toHaveBeenCalled()
  expect(disposePreviewMaterial).not.toHaveBeenCalled()
})

it('clears the local preview and renders no path when the active Token becomes hidden', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <TokenLayer tokens={[TOKEN]} onMoveIntent={vi.fn()} />,
  )
  const target = await beginDrag(renderer)

  await renderer.update(<TokenLayer tokens={[{ ...TOKEN, visible: false }]} onMoveIntent={vi.fn()} />)

  expect(renderer.scene.findAllByProps({ name: 'movement-preview' })).toHaveLength(0)
  expect(useBattleMapView.getState().dragPreview).toBeNull()
  expect(target.releasePointerCapture).toHaveBeenCalledOnce()
  await renderer.unmount()
})

it('clears the local preview when the active Token is removed', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <TokenLayer tokens={[TOKEN]} onMoveIntent={vi.fn()} />,
  )
  const target = await beginDrag(renderer)

  await renderer.update(<TokenLayer tokens={[]} onMoveIntent={vi.fn()} />)

  expect(renderer.scene.findAllByProps({ name: 'movement-preview' })).toHaveLength(0)
  expect(useBattleMapView.getState().dragPreview).toBeNull()
  expect(target.releasePointerCapture).toHaveBeenCalledOnce()
  await renderer.unmount()
})

it('does not let a stale animation override a later committed Token cell', async () => {
  const committedToken = { ...TOKEN, cell: { column: 20, row: 12 } }
  const renderer = await ReactThreeTestRenderer.create(
    <TokenLayer
      tokens={[committedToken]}
      onMoveIntent={vi.fn()}
      remoteTokenAnimations={[
        {
          tokenId: TOKEN.id,
          from: TOKEN.cell,
          to: { column: 13, row: 12 },
          eventStartMs: 1_000,
          durationMs: 1_000,
        },
      ]}
    />,
  )

  expect(renderer.scene.findAllByProps({ name: `animated-token-${TOKEN.id}` })).toHaveLength(0)
  expect(renderer.scene.findByProps({ name: `token-${TOKEN.id}` }).instance.position.toArray()).toEqual([
    20.5,
    0.25,
    12.5,
  ])
  await renderer.unmount()
})

it('uses the character renderer only for tokens with validated character state', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <TokenLayer tokens={[CHARACTER_TOKEN]} onMoveIntent={vi.fn()} />,
  )

  expect(renderer.scene.findByProps({ name: `character-token-${CHARACTER_TOKEN.id}` })).toBeDefined()
  expect(renderer.scene.findAllByProps({ name: `token-${CHARACTER_TOKEN.id}` })).toHaveLength(2)
  await renderer.unmount()
})
