import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { PNG } from 'pngjs'

type ScreenPoint = Readonly<{ x: number; y: number }>

async function locateFixtureToken(
  page: Page,
  canvas: Locator,
  useDiagnostics = true,
): Promise<ScreenPoint> {
  if (useDiagnostics) {
    const encoded = await page.getByTestId('scene-performance-diagnostics').getAttribute(
      'data-interaction-token-point',
    )
    if (encoded) return JSON.parse(encoded) as ScreenPoint
  }
  const image = PNG.sync.read(await canvas.screenshot())
  const points: ScreenPoint[] = []
  const centerX = image.width / 2
  const centerY = image.height / 2

  for (let y = Math.floor(centerY - 180); y <= Math.ceil(centerY + 180); y += 1) {
    for (let x = Math.floor(centerX - 180); x <= Math.ceil(centerX + 180); x += 1) {
      const index = (y * image.width + x) * 4
      const red = image.data[index]!
      const green = image.data[index + 1]!
      const blue = image.data[index + 2]!
      if (green > 150 && green > red * 1.7 && green > blue * 1.35) points.push({ x, y })
    }
  }

  expect(points.length).toBeGreaterThan(25)
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  }
}

test('previews a snapped Token drag and emits one MoveIntent on release', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const diagnostics = page.getByTestId('token-interaction-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-move-intents', '[]')
  const canvas = page.getByTestId('battle-map-canvas')
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2)
  for (let step = 0; step < 10; step += 1) await page.mouse.wheel(0, -1_000)
  await expect(page.getByTestId('chunk-diagnostics')).toHaveAttribute('data-mode', 'detail')

  const from = await locateFixtureToken(page, canvas)
  const encodedPoint = await page.getByTestId('scene-performance-diagnostics').getAttribute(
    'data-interaction-token-point',
  )
  const projected = JSON.parse(encodedPoint ?? '') as ScreenPoint
  await page.mouse.move(canvasBox!.x + projected.x, canvasBox!.y + projected.y)
  await page.mouse.down()
  await expect(diagnostics).toHaveAttribute('data-drag-preview', '')
  await page.mouse.move(canvasBox!.x + projected.x + 108, canvasBox!.y + projected.y, { steps: 4 })

  await expect(diagnostics).toHaveAttribute(
    'data-drag-preview',
    JSON.stringify({ tokenId: 'fixture-token', cell: { column: 102, row: 99 } }),
  )
  const preview = await locateFixtureToken(page, canvas, false)
  expect(preview.x - from.x).toBeGreaterThan(90)

  await page.mouse.up()

  await expect(diagnostics).toHaveAttribute('data-drag-preview', '')
  await expect(diagnostics).toHaveAttribute(
    'data-move-intents',
    JSON.stringify([
      {
        tokenId: 'fixture-token',
        from: { column: 99, row: 99 },
        to: { column: 102, row: 99 },
        path: [
          { column: 99, row: 99 },
          { column: 100, row: 99 },
          { column: 101, row: 99 },
          { column: 102, row: 99 },
        ],
      },
    ]),
  )
})
