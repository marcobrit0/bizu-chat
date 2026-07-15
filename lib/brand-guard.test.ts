import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components", "lib", "artifacts"];
const EXTENSIONS = [".ts", ".tsx"];

// Strings that must never reach a Bizu user.
const FORBIDDEN = [
  "Deploy with Vercel",
  "VercelIcon",
  "vercel.com/templates",
  "AI Chatbot Starter Template",
  "Activate AI Gateway",
  "add-credit-card",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (
      // This guard file necessarily contains the forbidden strings.
      EXTENSIONS.some((e) => full.endsWith(e)) &&
      !full.endsWith("brand-guard.test.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("brand guard", () => {
  const files = ROOTS.flatMap((r) => sourceFiles(r));

  it("scans a non-trivial number of files", () => {
    // Guards against a broken walker silently passing.
    expect(files.length).toBeGreaterThan(50);
  });

  for (const forbidden of FORBIDDEN) {
    it(`never ships "${forbidden}"`, () => {
      const offenders = files.filter((f) =>
        readFileSync(f, "utf8").includes(forbidden)
      );
      expect(offenders).toEqual([]);
    });
  }
});
