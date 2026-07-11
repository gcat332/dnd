import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

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
  test.setTimeout(45_000)
  await page.goto('/?stress=1')
  const diagnostics = page.getByTestId('scene-performance-diagnostics')
  const canvas = page.getByTestId('battle-map-canvas')
  const expectedHighDpr = await page.evaluate(() => Math.min(window.devicePixelRatio, 2))

  await expect(diagnostics).toHaveAttribute('data-object-count', '200')
  await expect(page.getByTestId('effects-animation-diagnostics')).toHaveAttribute(
    'data-active-animation-count',
    /[1-9]\d*/,
  )
  await expect(diagnostics).toHaveAttribute('data-stress-token-point', /.+/)
  await expect.poll(async () => {
    const state = JSON.parse((await diagnostics.getAttribute('data-renderer-state')) ?? '{}') as {
      shadowCastingLights?: number
      shadowType?: string
      softShadows?: boolean
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
  for (let sample = 0; sample < 3; sample += 1) {
    await page.mouse.click(canvasBox!.x + tokenPoint.x, canvasBox!.y + tokenPoint.y)
  }
  await page.mouse.move(canvasBox!.x + tokenPoint.x, canvasBox!.y + tokenPoint.y)
  await page.mouse.down()
  await page.mouse.move(canvasBox!.x + tokenPoint.x + 36, canvasBox!.y + tokenPoint.y, { steps: 3 })
  await page.mouse.up()
  await expect(page.getByTestId('token-interaction-diagnostics')).toHaveAttribute(
    'data-move-intents',
    /stress-object-050/,
  )
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
  expect(metrics.p95ChunkLatencyMs).toBeGreaterThan(0)
  expect(metrics.sceneResourceBytes).toBeGreaterThan(0)

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
