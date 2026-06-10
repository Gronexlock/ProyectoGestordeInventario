import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/alertService.ts',
        'src/services/replenishmentService.ts',
        'src/services/movementService.ts',
        'src/services/syncService.ts',
        'src/services/pickingService.ts',
        'src/services/stockService.ts',
        'src/services/reservationService.ts',
        'src/utils/disableNumberInputWheel.ts',
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
})
