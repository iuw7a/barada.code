import { describe, it, expect } from "vitest";
import { normalizePath, parentDir, isInsideDir, isDirectChildOf } from "../src/lib/projects/pathSafe";

describe("normalizePath (path traversal protection)", () => {
  it("accepts normal relative paths", () => {
    expect(normalizePath("src/App.tsx")).toBe("src/App.tsx");
    expect(normalizePath("index.html")).toBe("index.html");
    expect(normalizePath("a/b/c/deep/file.css")).toBe("a/b/c/deep/file.css");
  });

  it("strips leading slashes", () => {
    expect(normalizePath("/src/App.tsx")).toBe("src/App.tsx");
  });

  it("rejects absolute paths", () => {
    expect(() => normalizePath("C:/Windows/system32")).toThrow();
    expect(() => normalizePath("C:\\temp")).toThrow();
  });

  it("rejects .. traversal", () => {
    expect(() => normalizePath("../etc/passwd")).toThrow();
    expect(() => normalizePath("src/../../etc/passwd")).toThrow();
    expect(() => normalizePath("..")).toThrow();
  });

  it("rejects . segments", () => {
    expect(() => normalizePath("./src")).toThrow();
  });

  it("rejects backslashes", () => {
    expect(() => normalizePath("src\\App.tsx")).toThrow();
  });

  it("rejects control characters", () => {
    expect(() => normalizePath("src/\u0000evil")).toThrow();
    expect(() => normalizePath("src/\nnewline")).toThrow();
  });

  it("rejects empty and oversized paths", () => {
    expect(() => normalizePath("")).toThrow();
    expect(() => normalizePath("a".repeat(513))).toThrow();
  });

  it("rejects empty segments (double slashes)", () => {
    expect(() => normalizePath("src//App.tsx")).toThrow();
  });

  it("rejects Windows reserved names", () => {
    expect(() => normalizePath("CON")).toThrow();
    expect(() => normalizePath("NUL.txt")).toThrow();
  });
});

describe("parentDir / isInsideDir / isDirectChildOf", () => {
  it("computes parent dirs", () => {
    expect(parentDir("src/App.tsx")).toBe("src");
    expect(parentDir("file.txt")).toBe("");
    expect(parentDir("a/b/c.txt")).toBe("a/b");
  });

  it("checks containment", () => {
    expect(isInsideDir("src/App.tsx", "src")).toBe(true);
    expect(isInsideDir("src/x/App.tsx", "src")).toBe(true);
    expect(isInsideDir("src", "src")).toBe(true);
    expect(isInsideDir("other/App.tsx", "src")).toBe(false);
    expect(isInsideDir("anything", "")).toBe(true);
  });

  it("checks direct children", () => {
    expect(isDirectChildOf("src/App.tsx", "src")).toBe(true);
    expect(isDirectChildOf("src/x/App.tsx", "src")).toBe(false);
    expect(isDirectChildOf("file.txt", "")).toBe(true);
  });
});
