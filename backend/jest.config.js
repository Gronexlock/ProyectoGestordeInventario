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
    "src/controllers/alert.controller.ts",
    "src/controllers/replenishment.controller.ts",
    "src/utils/errors.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  clearMocks: true,
};
