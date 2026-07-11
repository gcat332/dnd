import { expect, test } from '@playwright/test'

async function enterDetailView(page: import('@playwright/test').Page, viewer: 'dm' | 'player') {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/?viewer=${viewer}`)
  const diagnostics = page.getByTestId('visibility-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-viewer', viewer)
  await page.mouse.wheel(0, -2400)
  await expect(page.getByTestId('chunk-diagnostics')).toHaveAttribute('data-mode', 'detail')
  return diagnostics
}

test('separates DM and Player visibility while lights remain renderer-only', async ({ page }) => {
  await enterDetailView(page, 'dm')
  const canvas = page.getByTestId('battle-map-canvas')
  const dmFrame = await canvas.screenshot()

  const playerDiagnostics = await enterDetailView(page, 'player')
  await expect(playerDiagnostics).toHaveAttribute('data-visible-token-ids', 'fixture-token')
  const playerFrame = await canvas.screenshot()
  expect(playerFrame.equals(dmFrame)).toBe(false)

  const checksum = await playerDiagnostics.getAttribute('data-visibility-checksum')
  const lightCell = await playerDiagnostics.getAttribute('data-moving-light-cell')
  const beforeLightMove = await canvas.screenshot()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('battle-map:move-light')))

  await expect(playerDiagnostics).not.toHaveAttribute('data-moving-light-cell', lightCell ?? '')
  await expect(playerDiagnostics).toHaveAttribute('data-visibility-checksum', checksum ?? '')
  const afterLightMove = await canvas.screenshot()
  expect(afterLightMove.equals(beforeLightMove)).toBe(false)
})
