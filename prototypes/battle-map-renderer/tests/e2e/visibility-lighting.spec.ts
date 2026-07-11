import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { PNG } from 'pngjs'

type ScreenPoint = Readonly<{ x: number; y: number }>
type ProbePoints = Readonly<{
  visible: ScreenPoint
  explored: ScreenPoint
  hidden: ScreenPoint
}>

async function openViewer(page: Page, viewer: 'dm' | 'player') {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/?viewer=${viewer}`)
  const diagnostics = page.getByTestId('visibility-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-viewer', viewer)
  await expect(diagnostics).toHaveAttribute('data-visibility-probe-points', /.+/)
  return diagnostics
}

async function enterDetailView(page: Page) {
  await page.mouse.wheel(0, -2400)
  await expect(page.getByTestId('chunk-diagnostics')).toHaveAttribute('data-mode', 'detail')
}

async function probeLuminance(canvas: Locator, diagnostics: Locator) {
  const encoded = await diagnostics.getAttribute('data-visibility-probe-points')
  const points = JSON.parse(encoded ?? '') as ProbePoints
  const frame = PNG.sync.read(await canvas.screenshot())

  const luminanceAt = (point: ScreenPoint) => {
    const x = Math.max(0, Math.min(frame.width - 1, Math.round(point.x)))
    const y = Math.max(0, Math.min(frame.height - 1, Math.round(point.y)))
    const index = (y * frame.width + x) * 4
    return (frame.data[index]! + frame.data[index + 1]! + frame.data[index + 2]!) / 3
  }

  return {
    visible: luminanceAt(points.visible),
    explored: luminanceAt(points.explored),
    hidden: luminanceAt(points.hidden),
  }
}

function expectVisibilityBands(probes: Awaited<ReturnType<typeof probeLuminance>>) {
  expect(probes.hidden).toBeLessThan(8)
  expect(probes.explored).toBeGreaterThan(probes.hidden + 5)
  expect(probes.visible).toBeGreaterThan(probes.explored + 10)
}

test('separates DM and Player visibility while lights remain renderer-only', async ({ page }) => {
  await openViewer(page, 'dm')
  const canvas = page.getByTestId('battle-map-canvas')
  const dmFrame = await canvas.screenshot()

  const playerDiagnostics = await openViewer(page, 'player')
  await expect(playerDiagnostics).toHaveAttribute('data-visible-token-ids', 'fixture-token')
  await expect(page.getByTestId('chunk-diagnostics')).toHaveAttribute('data-mode', 'overview')
  expectVisibilityBands(await probeLuminance(canvas, playerDiagnostics))
  const playerOverviewFrame = await canvas.screenshot()
  expect(playerOverviewFrame.equals(dmFrame)).toBe(false)

  await enterDetailView(page)
  expectVisibilityBands(await probeLuminance(canvas, playerDiagnostics))

  const checksum = await playerDiagnostics.getAttribute('data-visibility-checksum')
  const lightCell = await playerDiagnostics.getAttribute('data-moving-light-cell')
  const beforeLightMove = await canvas.screenshot()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('battle-map:move-light')))

  await expect(playerDiagnostics).not.toHaveAttribute('data-moving-light-cell', lightCell ?? '')
  await expect(playerDiagnostics).toHaveAttribute('data-visibility-checksum', checksum ?? '')
  const afterLightMove = await canvas.screenshot()
  expect(afterLightMove.equals(beforeLightMove)).toBe(false)
})
