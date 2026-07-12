import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Locator, Page } from '@playwright/test'

type ScreenPoint = Readonly<{ x: number; y: number }>

async function canvasBox(canvas: Locator) {
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function drag(
  page: Page,
  canvas: Locator,
  button: 'right' | 'middle',
  from: ScreenPoint,
  to: ScreenPoint,
) {
  const box = await canvasBox(canvas)
  await page.mouse.move(box.x + from.x, box.y + from.y)
  await page.mouse.down({ button })
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 })
  await page.mouse.up({ button })
}

async function fixturePoint(page: Page): Promise<ScreenPoint> {
  const diagnostics = page.getByTestId('scene-performance-diagnostics')
  let encoded = ''
  await expect
    .poll(async () => {
      encoded = (await diagnostics.getAttribute('data-interaction-token-point')) ?? ''
      return encoded
    })
    .not.toBe('')
  return JSON.parse(encoded) as ScreenPoint
}

async function nonblank(canvas: Locator) {
  const image = PNG.sync.read(await canvas.screenshot())
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 6) break
  }
  expect(colors.size).toBeGreaterThanOrEqual(6)
}

async function dispatchTwoPointerGesture(page: Page, point: ScreenPoint) {
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('[data-testid="battle-map-canvas"] canvas')
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing battle map canvas')
    const emit = (
      type: 'pointerdown' | 'pointermove' | 'pointerup',
      pointerId: number,
      clientX: number,
      clientY: number,
      isPrimary: boolean,
    ) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId,
          pointerType: 'touch',
          isPrimary,
          button: type === 'pointerup' ? 0 : 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX,
          clientY,
        }),
      )
    }
    emit('pointerdown', 31, x, y, true)
    emit('pointerdown', 32, x + 80, y + 10, false)
    emit('pointermove', 31, x - 40, y + 40, true)
    emit('pointermove', 32, x + 120, y - 30, false)
    emit('pointerup', 31, x - 40, y + 40, true)
    emit('pointerup', 32, x + 120, y - 30, false)
  }, point)
}

test('orbits with right drag while keeping pitch in the tabletop range', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const diagnostics = page.getByTestId('camera-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-yaw', '0.000')
  await fixturePoint(page)

  const box = await canvasBox(canvas)
  await drag(page, canvas, 'right', { x: 160, y: box.height / 2 }, { x: 760, y: box.height / 2 })

  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-yaw')))
    .not.toBe(0)
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-pitch')))
    .toBeGreaterThanOrEqual(35)
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-pitch')))
    .toBeLessThanOrEqual(90)
})

test('wheel zoom and middle drag pan without changing Token interaction state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  await fixturePoint(page)
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(tokens).toHaveAttribute('data-move-intents', '[]')

  const box = await canvasBox(canvas)
  await page.mouse.move(box.x + 180, box.y + box.height / 2)
  await page.mouse.wheel(0, -800)
  await expect.poll(async () => Number(await camera.getAttribute('data-zoom'))).not.toBe(4)
  const zoom = await camera.getAttribute('data-zoom')

  const focusBefore = await camera.getAttribute('data-focus')
  await drag(page, canvas, 'middle', { x: 180, y: box.height / 2 }, { x: 340, y: box.height / 2 + 80 })
  await expect.poll(async () => camera.getAttribute('data-focus')).not.toBe(focusBefore)
  await expect(camera).toHaveAttribute('data-zoom', zoom ?? '')
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(tokens).toHaveAttribute('data-drag-preview', '')
  await expect(tokens).toHaveAttribute('data-move-intents', '[]')
})

test('camera presets publish their exact logical views', async ({ page }) => {
  await page.goto('/')
  const camera = page.getByTestId('camera-diagnostics')
  const toolbar = page.getByRole('toolbar', { name: 'Camera view' })
  await fixturePoint(page)

  await toolbar.getByRole('button', { name: 'Top view' }).click()
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await expect(camera).toHaveAttribute('data-pitch', '90.000')
  await expect(camera).toHaveAttribute('data-zoom', '4.000')
  await expect(camera).toHaveAttribute('data-focus', '100.000:100.000')

  await toolbar.getByRole('button', { name: 'Face north' }).click()
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await expect(camera).toHaveAttribute('data-pitch', '90.000')

  await toolbar.getByRole('button', { name: 'Reset camera' }).click()
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await expect(camera).toHaveAttribute('data-pitch', '55.000')
  await expect(camera).toHaveAttribute('data-zoom', '4.000')
  await expect(camera).toHaveAttribute('data-focus', '100.000:100.000')
})

test('fades the selected Token occluder and clears it after orbiting behind the wall', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  const point = await fixturePoint(page)
  const box = await canvasBox(canvas)
  await page.mouse.click(box.x + point.x, box.y + point.y)
  await expect(tokens).toHaveAttribute('data-selected-token-id', 'fixture-token')
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', 'fixture-wall')

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const yaw = Number(await camera.getAttribute('data-yaw'))
    const direction = yaw < 180 ? 1 : -1
    await drag(
      page,
      canvas,
      'right',
      { x: 160, y: box.height / 2 },
      { x: 160 + direction * 650, y: box.height / 2 },
    )
    if ((await camera.getAttribute('data-faded-terrain-ids')) === '') break
  }
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', '')
})

test('player view cannot select the hidden Token or fade terrain for it', async ({ page }) => {
  await page.goto('/?viewer=player')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  await expect(page.getByTestId('visibility-diagnostics')).toHaveAttribute(
    'data-visible-token-ids',
    'fixture-token',
  )
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', '')

  const point = await fixturePoint(page)
  const canvas = page.getByTestId('battle-map-canvas')
  const box = await canvasBox(canvas)
  await page.mouse.click(box.x + point.x + 52, box.y + point.y)
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', '')
})

test('keeps the rendered canvas nonblank at reset, shallow, and top views', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const toolbar = page.getByRole('toolbar', { name: 'Camera view' })
  await fixturePoint(page)
  await expect(camera).toHaveAttribute('data-pitch', '55.000')
  await nonblank(canvas)

  const box = await canvasBox(canvas)
  await drag(page, canvas, 'right', { x: 700, y: box.height / 2 }, { x: 700, y: 20 })
  await expect.poll(async () => Number(await camera.getAttribute('data-pitch'))).toBe(35)
  await nonblank(canvas)

  await toolbar.getByRole('button', { name: 'Top view' }).click()
  await expect(camera).toHaveAttribute('data-pitch', '90.000')
  await nonblank(canvas)
})

test('separates one-pointer Token drag from a two-pointer empty-map gesture', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  const box = await canvasBox(canvas)
  const point = await fixturePoint(page)
  await page.mouse.move(box.x + point.x, box.y + point.y)
  await page.mouse.down()
  await page.mouse.move(box.x + point.x + 108, box.y + point.y, { steps: 4 })
  await expect.poll(async () => {
    const encoded = await tokens.getAttribute('data-drag-preview')
    if (!encoded) return null
    return JSON.parse(encoded) as { tokenId: string; cell: { column: number; row: number } }
  }).toMatchObject({ tokenId: 'fixture-token', cell: { row: 99 } })
  const preview = JSON.parse((await tokens.getAttribute('data-drag-preview')) ?? '{}') as {
    cell?: { column?: number }
  }
  expect(preview.cell?.column).toBeGreaterThan(99)
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await page.mouse.up()
  await expect(tokens).toHaveAttribute('data-drag-preview', '')

  const beforeYaw = await camera.getAttribute('data-yaw')
  const beforeZoom = await camera.getAttribute('data-zoom')
  await dispatchTwoPointerGesture(page, { x: box.x + 160, y: box.y + 180 })
  await expect
    .poll(async () => {
      const yaw = await camera.getAttribute('data-yaw')
      const zoom = await camera.getAttribute('data-zoom')
      return yaw !== beforeYaw || zoom !== beforeZoom
    })
    .toBe(true)
  await expect(tokens).toHaveAttribute('data-move-intents', expect.stringContaining('fixture-token'))
})
