import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const { detectChangedScope, listChangedPaths } =
  (await import("../../scripts/ci-changed-scope.mjs")) as unknown as {
    detectChangedScope: (paths: string[]) => {
      runNode: boolean;
      runAndroid: boolean;
      runSkillsPython: boolean;
    };
    listChangedPaths: (base: string, head?: string) => string[];
  };

const markerPaths: string[] = [];

afterEach(() => {
  for (const markerPath of markerPaths) {
    try {
      fs.unlinkSync(markerPath);
    } catch {}
  }
  markerPaths.length = 0;
});

describe("detectChangedScope", () => {
  it("fails safe when no paths are provided", () => {
    expect(detectChangedScope([])).toEqual({
      runNode: true,
      runAndroid: true,
      runSkillsPython: true,
    });
  });

  it("keeps all lanes off for docs-only changes", () => {
    expect(detectChangedScope(["docs/ci.md", "README.md"])).toEqual({
      runNode: false,
      runAndroid: false,
      runSkillsPython: false,
    });
  });

  it("enables node lane for node-relevant files", () => {
    expect(detectChangedScope(["src/plugins/runtime/index.ts"])).toEqual({
      runNode: true,
      runAndroid: false,
      runSkillsPython: false,
    });
  });

  it("keeps node lane off for native-only changes", () => {
    expect(detectChangedScope(["apps/android/app/build.gradle.kts"])).toEqual({
      runNode: false,
      runAndroid: true,
      runSkillsPython: false,
    });
  });

  it("enables node lane for non-native non-doc files by fallback", () => {
    expect(detectChangedScope(["README.md"])).toEqual({
      runNode: false,
      runAndroid: false,
      runSkillsPython: false,
    });

    expect(detectChangedScope(["assets/icon.png"])).toEqual({
      runNode: true,
      runAndroid: false,
      runSkillsPython: false,
    });
  });

  it("runs Python skill tests when skills change", () => {
    expect(detectChangedScope(["skills/openai-image-gen/scripts/test_gen.py"])).toEqual({
      runNode: true,
      runAndroid: false,
      runSkillsPython: true,
    });
  });

  it("treats base and head as literal git args", () => {
    const markerPath = path.join(
      os.tmpdir(),
      `openclaw-ci-changed-scope-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    );
    markerPaths.push(markerPath);

    const injectedBase = `HEAD; touch "${markerPath}" #`;

    expect(() => listChangedPaths(injectedBase, "HEAD")).toThrow();
    expect(fs.existsSync(markerPath)).toBe(false);
  });
});
