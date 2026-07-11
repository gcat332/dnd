import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // These tests hit one shared local Postgres/Auth instance via admin APIs
    // (user creation, campaign/battle-map cleanup) rather than an isolated
    // per-file sandbox. Running test files in parallel (vitest's default)
    // races concurrent `auth.admin.createUser` calls against the same GoTrue
    // container and intermittently fails with AuthRetryableFetchError —
    // reproduced by adding a second integration test file in this task.
    // Forcing files to run sequentially removes the race; the integration
    // suite is small enough that this costs negligible wall-clock time.
    fileParallelism: false,
  },
})
