/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  moduleNameMapper: {
    "^.+/prisma/client$": "<rootDir>/src/__tests__/__mocks__/prismaClient.ts",
  },
  collectCoverageFrom: [
    "src/services/movement.service.ts",
    "src/services/alert.service.ts",
    "src/services/replenishment.service.ts",
    "src/services/location.service.ts",
    "src/services/sync.service.ts",
    "src/services/picking.service.ts",
    // Servicios críticos agregados para cobertura real (requieren tests propios)
    "src/services/reservation.service.ts",
    "src/services/order.service.ts",
    "src/services/stock.service.ts",
    "src/controllers/alert.controller.ts",
    "src/controllers/replenishment.controller.ts",
    "src/utils/errors.ts",
  ],
  coverageThreshold: {
    global: {
      // Umbral reducido temporalmente al incorporar reservation.service.ts,
      // order.service.ts y stock.service.ts que aún no tienen tests unitarios.
      // Incrementar progresivamente a medida que se agreguen los tests faltantes.
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  clearMocks: true,
};
