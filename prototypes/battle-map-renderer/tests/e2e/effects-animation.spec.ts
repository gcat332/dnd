import { expect, test } from '@playwright/test'

const CIRCLE_CELLS = [
  { column: 99, row: 98 },
  { column: 98, row: 99 },
  { column: 99, row: 99 },
  { column: 100, row: 99 },
  { column: 99, row: 100 },
]

const CONE_CELLS = [
  { column: 101, row: 97 },
  { column: 100, row: 98 },
  { column: 101, row: 98 },
  { column: 99, row: 99 },
  { column: 100, row: 99 },
  { column: 101, row: 99 },
  { column: 100, row: 100 },
  { column: 101, row: 100 },
  { column: 101, row: 101 },
]

const LINE_CELLS = [
  { column: 99, row: 99 },
  { column: 100, row: 99 },
  { column: 101, row: 99 },
]

test('switches targeting templates and resumes a late remote Token animation', async ({ page }) => {
  await page.clock.install({ time: 0 })
  await page.goto('/')
  await page.clock.pauseAt(60_000)

  const diagnostics = page.getByTestId('effects-animation-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-template-kind', 'circle')
  await expect(diagnostics).toHaveAttribute('data-target-cells', JSON.stringify(CIRCLE_CELLS))

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('battle-map:set-template', { detail: { kind: 'cone' } })),
  )
  await expect(diagnostics).toHaveAttribute('data-template-kind', 'cone')
  await expect(diagnostics).toHaveAttribute('data-target-cells', JSON.stringify(CONE_CELLS))

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('battle-map:set-template', { detail: { kind: 'line' } })),
  )
  await expect(diagnostics).toHaveAttribute('data-template-kind', 'line')
  await expect(diagnostics).toHaveAttribute('data-target-cells', JSON.stringify(LINE_CELLS))

  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('battle-map:remote-token-update', {
        detail: {
          tokenId: 'fixture-token',
          from: { column: 99, row: 99 },
          to: { column: 103, row: 99 },
          eventStartMs: Date.now() - 500,
          durationMs: 1_000,
        },
      }),
    ),
  )

  await expect(diagnostics).toHaveAttribute(
    'data-animated-token-point',
    JSON.stringify({ x: 101.5, z: 99.5 }),
  )
  await page.clock.runFor(516)
  await expect(diagnostics).toHaveAttribute(
    'data-animated-token-point',
    JSON.stringify({ x: 103.5, z: 99.5 }),
  )
})
