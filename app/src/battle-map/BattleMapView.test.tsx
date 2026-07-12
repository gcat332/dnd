import { Canvas } from '@react-three/fiber'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { ReactElement } from 'react'
import { beforeEach, expect, it } from 'vitest'
import { ControlledOrbitCamera } from './camera/ControlledOrbitCamera'
import { CameraToolbar } from './camera/CameraToolbar'
import { useBattleMapView } from './state/useBattleMapView'
import { BattleMapView } from './BattleMapView'
import { BattleMapScene } from './scene/BattleMapScene'

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

// NOTE ON TEST STRATEGY:
// The brief's original Step 1 test called `ReactThreeTestRenderer.create(<BattleMapView />)`
// directly. That fails empirically: `@react-three/test-renderer` provides its OWN fake
// canvas/root and expects to be handed scene content (mesh/group/etc.), not a component that
// renders a *real* `@react-three/fiber` `<Canvas>`. `<Canvas>` mounts a real DOM `<canvas>` via
// a DOM-renderer reconciler and only then spins up a *separate* R3F reconciler root for its
// children — feeding that whole DOM-mounting tree through test-renderer's R3F-only reconciler
// throws "R3F: Canvas is not part of the THREE namespace!" (confirmed by tracing
// @react-three/fiber's `validateInstance`/`createInstance`). No other test in this repo renders
// a `<Canvas>` through `@react-three/test-renderer` for the same reason. A jsdom/RTL mount was
// also tried: `<Canvas>` never finishes initializing (this suite's stub `ResizeObserver` never
// reports a nonzero size), so the scene graph never actually builds — that path would only ever
// produce a rubber-stamp test, not real verification.
//
// So this file verifies the same guarantees via the two halves that together are what
// `BattleMapView` composes:
//   1. `BattleMapScene` (the exact same call `BattleMapView` makes) mounted through
//      `@react-three/test-renderer`, producing a real Three.js scene graph — same procedural
//      grid / empty token layer assertions the brief specified.
//   2. `BattleMapView`'s own returned element tree (calling the function directly — no
//      rendering needed for a plain element-tree check) confirming the `Canvas` props and the
//      composition order match the brief exactly. The shared camera adapter has its own
//      React Three Test Renderer coverage.

it('mounts the battle map scene with no tokens or terrain data', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BattleMapScene />)

  expect(renderer.scene.findByProps({ name: 'procedural-grid' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'token-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'token-layer' }).children).toHaveLength(0)

  await renderer.unmount()
})

it('composes the Canvas with the validated prototype camera/gl config', () => {
  const view = BattleMapView() as ReactElement<{
    className: string
    children: ReactElement<Record<string, unknown>>[]
  }>
  expect(view.props.className).toBe('battle-map-view')

  expect(view.props.children).toHaveLength(2)
  const [canvasElement, toolbarElement] = view.props.children
  if (!canvasElement || !toolbarElement) throw new Error('expected Canvas and camera toolbar')
  expect(canvasElement.type).toBe(Canvas)
  expect(toolbarElement.type).toBe(CameraToolbar)
  expect(canvasElement.props).toMatchObject({
    orthographic: true,
    frameloop: 'demand',
    camera: { position: [100, 150, 160], rotation: [-1.19, 0, 0], zoom: 4 },
    gl: { antialias: true, powerPreference: 'high-performance' },
  })

  const children = canvasElement.props.children as ReactElement<Record<string, unknown>>[]
  expect(children).toHaveLength(3)
  const [colorElement, cameraControlsElement, sceneElement] = children
  if (!colorElement || !cameraControlsElement || !sceneElement) {
    throw new Error('expected Canvas to have exactly three children')
  }
  expect(colorElement.type).toBe('color')
  expect(colorElement.props).toMatchObject({ attach: 'background', args: ['#171a1f'] })
  expect(cameraControlsElement.type).toBe(ControlledOrbitCamera)
  expect(sceneElement.type).toBe(BattleMapScene)
})
