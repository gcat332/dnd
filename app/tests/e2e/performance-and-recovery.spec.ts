import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { PNG } from 'pngjs'

type ScreenPoint = Readonly<{ x: number; y: number }>

async function locateGreenTokenNear(canvas: Locator, hint: ScreenPoint): Promise<ScreenPoint> {
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const image = PNG.sync.read(await canvas.screenshot())
  const scaleX = image.width / box!.width
  const scaleY = image.height / box!.height
  const centerX = hint.x * scaleX
  const centerY = hint.y * scaleY
  const radiusX = 30 * scaleX
  const radiusY = 30 * scaleY
  const points: ScreenPoint[] = []

  for (let y = Math.max(0, Math.floor(centerY - radiusY)); y <= Math.min(image.height - 1, Math.ceil(centerY + radiusY)); y += 1) {
    for (let x = Math.max(0, Math.floor(centerX - radiusX)); x <= Math.min(image.width - 1, Math.ceil(centerX + radiusX)); x += 1) {
      const index = (y * image.width + x) * 4
      const red = image.data[index]!
      const green = image.data[index + 1]!
      const blue = image.data[index + 2]!
      if (green > 80 && green > red * 1.45 && green > blue * 1.2) points.push({ x, y })
    }
  }

  expect(points.length).toBeGreaterThan(10)
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length / scaleX,
    y: points.reduce((total, point) => total + point.y, 0) / points.length / scaleY,
  }
}

function expectNonblankCanvas(buffer: Buffer): void {
  const image = PNG.sync.read(buffer)
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 6) return
  }
  expect(colors.size).toBeGreaterThanOrEqual(6)
}

function hasMinimumColors(buffer: Buffer, minimum: number): boolean {
  const image = PNG.sync.read(buffer)
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= minimum) return true
  }
  return false
}

test('profiles 200 objects, applies low quality, and recovers the committed scene', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/?stress=1')
  const diagnostics = page.getByTestId('scene-performance-diagnostics')
  const chunkDiagnostics = page.getByTestId('chunk-diagnostics')
  const canvas = page.getByTestId('battle-map-canvas')
  const expectedHighDpr = await page.evaluate(() => Math.min(window.devicePixelRatio, 2))

  await expect(diagnostics).toHaveAttribute('data-object-count', '200')
  await expect(diagnostics).toHaveAttribute('data-stress-token-point', /.+/)
  const stressCanvasBox = await canvas.boundingBox()
  expect(stressCanvasBox).not.toBeNull()
  await page.mouse.move(stressCanvasBox!.x + 180, stressCanvasBox!.y + 180)
  await page.mouse.wheel(0, -2400)
  await expect(chunkDiagnostics).toHaveAttribute('data-center-chunk', '3:3')
  await expect(chunkDiagnostics).toHaveAttribute('data-visible-chunks', /(?:^|,)3:3(?:,|$)/)
  await expect(diagnostics).toHaveAttribute('data-maximum-class-detail-texture-count', '1', {
    timeout: 15_000,
  })
  await expect(diagnostics).toHaveAttribute(
    'data-maximum-class-texture-render',
    JSON.stringify({
      address: { column: 3, row: 3 },
      sourceWidth: 2048,
      sourceHeight: 2048,
      rendered: true,
      uploaded: true,
    }),
    { timeout: 15_000 },
  )
  await expect(page.getByTestId('effects-animation-diagnostics')).toHaveAttribute(
    'data-active-animation-count',
    /[1-9]\d*/,
  )
  await expect(diagnostics).toHaveAttribute('data-stress-token-point', /.+/)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('battle-map:set-quality', { detail: { quality: 'high' } }))
  })
  await expect.poll(async () => {
    const state = JSON.parse((await diagnostics.getAttribute('data-renderer-state')) ?? '{}') as {
      dpr?: number
      shadowCastingLights?: number
      shadowType?: string
      softShadows?: boolean
      shadowMapSizes?: number[]
      particleCount?: number
      toneMapping?: string
    }
    return state
  }).toMatchObject({
    dpr: expectedHighDpr,
    shadowCastingLights: 4,
    shadowType: 'PCFShadowMap',
    softShadows: true,
    shadowMapSizes: [2048, 2048, 2048, 2048],
    particleCount: 48,
    toneMapping: 'ACESFilmicToneMapping',
  })
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-frame-samples')), { timeout: 10_000 })
    .toBeGreaterThan(5)
  const tokenPoint = JSON.parse(
    (await diagnostics.getAttribute('data-stress-token-point')) ?? '',
  ) as { x: number; y: number }
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  const interactionPoint = await locateGreenTokenNear(canvas, tokenPoint)
  await page.mouse.move(canvasBox!.x + interactionPoint.x, canvasBox!.y + interactionPoint.y)
  await page.mouse.down()
  await expect(page.getByTestId('token-interaction-diagnostics')).toHaveAttribute(
    'data-selected-token-id',
    'stress-object-050',
  )
  await page.mouse.move(canvasBox!.x + interactionPoint.x + 108, canvasBox!.y + interactionPoint.y, { steps: 4 })
  await expect(page.getByTestId('token-interaction-diagnostics')).toHaveAttribute(
    'data-drag-preview',
    /stress-object-050/,
  )
  await page.mouse.up()
  await expect(page.getByTestId('token-interaction-diagnostics')).toHaveAttribute(
    'data-move-intents',
    /stress-object-050/,
  )
  for (let sample = 0; sample < 4; sample += 1) {
    await page.mouse.click(canvasBox!.x + interactionPoint.x, canvasBox!.y + interactionPoint.y)
  }
  const intents = JSON.parse(
    (await page.getByTestId('token-interaction-diagnostics').getAttribute('data-move-intents')) ?? '[]',
  ) as Array<{ from: ScreenPoint; to: ScreenPoint }>
  expect(intents).toHaveLength(1)
  expect(intents[0]!.to).not.toEqual(intents[0]!.from)
  await expect
    .poll(async () => {
      const current = JSON.parse((await diagnostics.getAttribute('data-metrics')) ?? '{}') as Record<string, number>
      return current.p95PointerToRenderedFrameLatencyMs
    })
    .toBeGreaterThan(0)
  const checksum = await diagnostics.getAttribute('data-token-checksum')
  const metrics = JSON.parse((await diagnostics.getAttribute('data-metrics')) ?? '{}') as Record<string, number>
  expect(metrics.averageFps).toBeGreaterThan(0)
  expect(metrics.p95FrameTimeMs).toBeGreaterThan(0)
  expect(metrics.drawCalls).toBeGreaterThan(0)
  expect(metrics.triangles).toBeGreaterThan(0)
  expect(metrics.textures).toBeGreaterThanOrEqual(0)
  expect(metrics.maximumClassDetailTextures).toBe(1)
  expect(metrics.p95ChunkLatencyMs).toBeGreaterThan(0)
  expect(metrics.sceneResourceBytes).toBeGreaterThanOrEqual(2048 * 2048 * 4)

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('battle-map:set-quality', { detail: { quality: 'low' } })),
  )
  await expect(diagnostics).toHaveAttribute('data-quality', 'low')
  await expect(diagnostics).toHaveAttribute('data-max-dpr', '1')
  await expect(diagnostics).toHaveAttribute('data-shadow-map-size', '512')
  await expect(diagnostics).toHaveAttribute('data-particle-scale', '0.25')
  await expect(diagnostics).toHaveAttribute('data-output-processing', 'false')
  await expect.poll(async () => {
    const state = JSON.parse((await diagnostics.getAttribute('data-renderer-state')) ?? '{}') as {
      dpr?: number
      shadowEnabled?: boolean
      shadowType?: string
      softShadows?: boolean
      shadowMapSizes?: number[]
      particleCount?: number
      toneMapping?: string
    }
    return {
      dpr: state.dpr,
      shadowEnabled: state.shadowEnabled,
      shadowType: state.shadowType,
      softShadows: state.softShadows,
      shadowMapSizes: state.shadowMapSizes,
      particleCount: state.particleCount,
      toneMapping: state.toneMapping,
    }
  }).toEqual({
    dpr: 1,
    shadowEnabled: false,
    shadowType: 'PCFSoftShadowMap',
    softShadows: false,
    shadowMapSizes: [512, 512, 512, 512],
    particleCount: 12,
    toneMapping: 'NoToneMapping',
  })
  if (expectedHighDpr > 1) {
    const lowState = JSON.parse(
      (await diagnostics.getAttribute('data-renderer-state')) ?? '{}',
    ) as { dpr: number }
    expect(lowState.dpr).toBeLessThan(expectedHighDpr)
  }

  const usedExtension = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const context = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
    const extension = context?.getExtension('WEBGL_lose_context')
    if (extension) {
      ;(window as typeof window & { __battleMapContextLoss?: WEBGL_lose_context }).__battleMapContextLoss = extension
      extension.loseContext()
    }
    else canvas?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    return Boolean(extension)
  })
  await expect(page.getByTestId('webgl-recovery')).toBeVisible()

  if (usedExtension) {
    await page.evaluate(() => {
      ;(window as typeof window & { __battleMapContextLoss?: WEBGL_lose_context }).__battleMapContextLoss?.restoreContext()
    })
  } else {
    await page.getByRole('button', { name: 'Retry renderer' }).click()
  }

  await expect(page.getByTestId('webgl-recovery')).toBeHidden()
  await expect(diagnostics).toHaveAttribute('data-token-checksum', checksum ?? '')
  await expect.poll(async () => hasMinimumColors(await canvas.screenshot(), 6)).toBe(true)

  const generation = Number(await diagnostics.getAttribute('data-renderer-generation'))
  await page.evaluate(() => {
    document.querySelector('canvas')?.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    )
  })
  await expect(page.getByTestId('webgl-recovery')).toBeVisible()
  await page.getByRole('button', { name: 'Retry renderer' }).click()
  await expect(diagnostics).toHaveAttribute('data-renderer-generation', String(generation + 1))
  await expect(diagnostics).toHaveAttribute('data-token-checksum', checksum ?? '')
  await expect.poll(async () => hasMinimumColors(await canvas.screenshot(), 6)).toBe(true)
  expectNonblankCanvas(await canvas.screenshot())
})
