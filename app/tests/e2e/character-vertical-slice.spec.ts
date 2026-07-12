import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

const CHARACTER_URL = '/?characters=1&manual=1'

async function nonblank(page: Page) {
  const canvas = page.getByTestId('battle-map-canvas')
  const image = PNG.sync.read(await canvas.screenshot())
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 8) break
  }
  expect(colors.size).toBeGreaterThanOrEqual(8)
}

async function dispatch(page: Page, detail: Record<string, unknown>) {
  await page.evaluate((value) => {
    window.dispatchEvent(new CustomEvent('battle-map:character-slice', { detail: value }))
  }, detail)
}

function diagnostics(page: Page) {
  return page.getByTestId('character-slice-diagnostics')
}

test('loads the three real character GLBs and keeps the domain cells stable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(CHARACTER_URL)

  const slice = diagnostics(page)
  await expect(slice).toHaveAttribute('data-loaded-recipe-ids', 'kaykit-knight,kaykit-mage,kaykit-skeleton', { timeout: 15_000 })
  await expect(slice).toHaveAttribute('data-asset-error-count', '0')
  await expect(slice).toHaveAttribute('data-mixer-count', '3', { timeout: 15_000 })
  const checksum = await page.getByTestId('scene-performance-diagnostics').getAttribute('data-token-checksum')
  await nonblank(page)

  await dispatch(page, { type: 'animation', tokenId: 'character-knight', animation: 'move' })
  await dispatch(page, { type: 'animation', tokenId: 'character-mage', animation: 'attack' })
  await dispatch(page, { type: 'animation', tokenId: 'character-skeleton', animation: 'hit' })
  await expect.poll(async () => (await slice.getAttribute('data-current-animations')) ?? '').toContain('"character-knight":"move"')
  await expect.poll(async () => Number((await slice.getAttribute('data-animation-transitions')) ?? '0')).toBeGreaterThanOrEqual(3)
  expect(await page.getByTestId('scene-performance-diagnostics').getAttribute('data-token-checksum')).toBe(checksum)
  expect(errors).toEqual([])
})

test('switches equipment and deduplicates replayed presentation events', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(CHARACTER_URL)
  const slice = diagnostics(page)
  await expect(slice).toHaveAttribute('data-loaded-recipe-ids', 'kaykit-knight,kaykit-mage,kaykit-skeleton', { timeout: 15_000 })
  await dispatch(page, {
    type: 'equipment',
    tokenId: 'character-knight',
    equipment: { mainHand: 'axe', back: 'sword', offHand: 'shield', head: 'helmet' },
  })
  await expect.poll(async () => (await slice.getAttribute('data-equipped-ids')) ?? '').toContain('"mainHand":"axe"')
  await expect.poll(async () => (await slice.getAttribute('data-equipped-ids')) ?? '').toContain('"back":"sword"')

  const event = {
    type: 'effect',
    effectId: 'melee_slash',
    sourceTokenId: 'character-knight',
    targetTokenId: 'character-skeleton',
    id: 'e2e-slash-replay',
  }
  await dispatch(page, event)
  await dispatch(page, event)
  await expect.poll(async () => (await slice.getAttribute('data-emitted-event-ids')) ?? '').toContain('e2e-slash-replay')
  const emitted = (await slice.getAttribute('data-emitted-event-ids')) ?? ''
  expect(emitted.split(',').filter((id) => id === 'e2e-slash-replay')).toHaveLength(1)
})

test('accepts a renderer-backed attack marker and reports optional asset fallback', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?characters=1&manual=1')
  const slice = diagnostics(page)
  await expect(slice).toHaveAttribute('data-loaded-recipe-ids', 'kaykit-knight,kaykit-mage,kaykit-skeleton', { timeout: 15_000 })

  await dispatch(page, { type: 'animation', tokenId: 'character-knight', animation: 'attack' })
  await expect.poll(async () => (await slice.getAttribute('data-current-animations')) ?? '', { timeout: 15_000 }).toContain(
    '"character-knight":"attack"',
  )
  await expect.poll(async () => (await slice.getAttribute('data-emitted-event-ids')) ?? '', { timeout: 15_000 }).toMatch(
    /character-attack-character-knight-/,
  )
  await expect.poll(async () => (await slice.getAttribute('data-active-event-ids')) ?? '', { timeout: 15_000 }).toMatch(
    /character-attack-character-knight-/,
  )

  await dispatch(page, { type: 'animation', tokenId: 'character-mage', animation: 'attack' })
  await expect.poll(async () => (await slice.getAttribute('data-emitted-event-effects')) ?? '', { timeout: 15_000 }).toMatch(
    /character-attack-character-mage-\d+:fire_projectile/,
  )

  await dispatch(page, {
    type: 'equipment',
    tokenId: 'character-mage',
    equipment: { mainHand: '__missing_optional_equipment__' },
  })
  await expect.poll(async () => Number((await slice.getAttribute('data-optional-fallback-count')) ?? '0')).toBeGreaterThan(0)
  await expect.poll(async () => Number((await slice.getAttribute('data-asset-error-count')) ?? '0')).toBeGreaterThan(0)
  await expect(slice).toHaveAttribute('data-mixer-count', '3')
})

test('keeps characters usable with empty optional equipment and recovers the renderer', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(CHARACTER_URL)
  const slice = diagnostics(page)
  await expect(page.getByTestId('camera-diagnostics')).toHaveAttribute('data-yaw', '0.000')
  await dispatch(page, { type: 'equipment', tokenId: 'character-mage', equipment: { mainHand: null } })
  await expect.poll(async () => (await slice.getAttribute('data-asset-error-count')) ?? '1').toBe('0')
  await expect.poll(async () => (await slice.getAttribute('data-mixer-count')) ?? '0').toBe('3')

  await page.evaluate(() => {
    window.dispatchEvent(new Event('battle-map:character-context-loss'))
  })
  await expect(page.getByTestId('webgl-recovery')).toBeVisible()
  await page.getByRole('button', { name: 'Retry renderer' }).click()
  await expect(page.getByTestId('webgl-recovery')).toBeHidden()
  await expect(slice).toHaveAttribute('data-mixer-count', '3')
  await nonblank(page)
})

test('captures named orbit readability evidence at representative camera angles', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(CHARACTER_URL)
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await expect(camera).toHaveAttribute('data-pitch', '55.000')
  await expect(camera).toHaveAttribute('data-zoom', '4.000')
  await expect(camera).toHaveAttribute('data-focus', '100.000:100.000')
  for (const pitch of ['35', '55', '90']) {
    await page.getByRole('button', { name: pitch === '90' ? 'Top view' : 'Reset camera' }).click()
    if (pitch === '35') {
      const box = await canvas.boundingBox()
      expect(box).not.toBeNull()
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await page.mouse.down({ button: 'right' })
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 150)
      await page.mouse.up({ button: 'right' })
    }
    if (pitch === '55') {
      await expect(camera).toHaveAttribute('data-yaw', '0.000')
      await expect(camera).toHaveAttribute('data-pitch', '55.000')
    }
    if (pitch === '90') {
      await expect(camera).toHaveAttribute('data-yaw', '0.000')
      await expect(camera).toHaveAttribute('data-pitch', '90.000')
    }
    await expect.poll(async () => Number(await camera.getAttribute('data-pitch'))).toBeGreaterThanOrEqual(35)
    await expect.poll(async () => Number(await camera.getAttribute('data-pitch'))).toBeLessThanOrEqual(90)
    for (const yaw of ['0', '90', '180', '270']) {
      if (yaw !== '0') {
        const box = await canvas.boundingBox()
        expect(box).not.toBeNull()
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
        await page.mouse.down({ button: 'right' })
        await page.mouse.move(box!.x + box!.width / 2 + Number(yaw) * 1.4, box!.y + box!.height / 2)
        await page.mouse.up({ button: 'right' })
      }
      await canvas.screenshot({ path: `test-results/character-${yaw}-${pitch}.png` })
      await nonblank(page)
      const focus = await camera.getAttribute('data-focus')
      expect(focus).toBe('100.000:100.000')
      expect(Number(await camera.getAttribute('data-zoom'))).toBeGreaterThanOrEqual(4)
      const yawValue = Number(await camera.getAttribute('data-yaw'))
      expect(Number.isFinite(yawValue)).toBe(true)
      expect(yawValue).toBeGreaterThanOrEqual(0)
      expect(yawValue).toBeLessThan(360)
      if (yaw === '0' && (pitch === '55' || pitch === '90')) expect(yawValue).toBe(0)
    }
  }
})

test('combines 40 character mixers with the 200-object stress harness', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?characters=1&stress=1')
  const slice = diagnostics(page)
  await expect(slice).toHaveAttribute('data-mixer-count', '40', { timeout: 30_000 })
  const scene = page.getByTestId('scene-performance-diagnostics')
  await expect(scene).toHaveAttribute('data-object-count', '240')
  await expect(scene).toHaveAttribute('data-combined-stress-object-count', '240')
  await expect.poll(async () => Number((await scene.getAttribute('data-frame-samples')) ?? '0')).toBeGreaterThan(0)
})
