// jest.config.ts
// npm install --save-dev jest @types/jest ts-jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom

import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment:  "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // 경로 매핑 (tsconfig paths와 동기화)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // 테스트 파일 패턴
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
  ],

  // 커버리지 수집 대상
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "src/components/**/*.tsx",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],

  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches:   60,
      functions:  60,
      lines:      60,
      statements: 60,
    },
  },
};

export default createJestConfig(config);
