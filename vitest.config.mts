import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    env: { NEXT_PUBLIC_API_URL: "https://api.stellarsafe.test" },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/**"],
      exclude: ["**/__tests__/**", "src/components/ui/**"],
      // Ratchet: raise these as coverage grows; CI fails if it drops below.
      thresholds: { statements: 45, branches: 34, functions: 38, lines: 45 },
    },
  },
});
