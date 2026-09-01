/**
 * Project file path safety.
 * All AI/tool/user file operations MUST go through normalizePath.
 * Rejects: absolute paths, `..` segments, backslashes, control chars,
 * leading/trailing slashes, empty segments, reserved names.
 */
export function normalizePath(input: string): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 512) {
    throw new Error("非法路径：长度");
  }
  if (/[\u0000-\u001f\u007f]/.test(input)) {
    throw new Error("非法路径：控制字符");
  }
  if (input.includes("\\")) {
    throw new Error("非法路径：不允许反斜杠");
  }
  // Normalize unicode separators & strip leading slashes
  let p = input.replace(/^\/+/, "");
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) {
    throw new Error("非法路径：不允许绝对路径");
  }
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === "" ) throw new Error("非法路径：空段");
    if (seg === "." || seg === "..") throw new Error("非法路径：不允许 . 或 ..");
    // Windows reserves these names with ANY extension (NUL.txt is reserved too)
    const base = seg.replace(/\.[^.]*$/, "");
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(base)) {
      throw new Error("非法路径：Windows 保留名");
    }
  }
  const normalized = segments.join("/");
  if (normalized.length === 0) throw new Error("非法路径：空");
  return normalized;
}

/** Parent directory of a normalized path ("" for root-level files). */
export function parentDir(normalizedPath: string): string {
  const i = normalizedPath.lastIndexOf("/");
  return i === -1 ? "" : normalizedPath.slice(0, i);
}

/** True if child is directly inside dir (both normalized). */
export function isDirectChildOf(child: string, dir: string): boolean {
  return parentDir(child) === dir;
}

/** True if path is dir itself or inside dir subtree. */
export function isInsideDir(path: string, dir: string): boolean {
  if (dir === "") return true;
  return path === dir || path.startsWith(dir + "/");
}
