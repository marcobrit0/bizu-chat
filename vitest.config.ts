import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // `tests/` belongs to Playwright (playwright.config.ts testDir: "./tests")
    exclude: ["**/node_modules/**", "**/.next/**", "tests/**"],
    include: ["**/*.test.ts"],
    // Zero test files today (Tasks 3-6 add the first ones); a crash is a
    // failure, an empty run is not.
    passWithNoTests: true,
  },
});
