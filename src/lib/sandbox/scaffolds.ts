/**
 * Framework scaffolds — professional starting points written into the project
 * (DB + disk) before the agent customizes them. Each scaffold is a minimal but
 * REAL, buildable project: package.json, tsconfig, source files, README,
 * .env.example. The agent then adds features on top via tools.
 */

import { syncedWrite, syncedMkdir } from "./sync";

export type ScaffoldKind =
  | "static" // pure HTML/CSS/JS — still supported for simple sites
  | "vite-react" // React + TypeScript + Vite
  | "express-api" // Node/Express REST API
  | "node-fullstack" // Express + static frontend + better-sqlite3-ready
  | "python-fastapi"; // FastAPI + requirements.txt

export function pickScaffold(request: { framework?: string | null; language?: string | null; brief?: string }): ScaffoldKind {
  const text = `${request.framework ?? ""} ${request.language ?? ""} ${request.brief ?? ""}`.toLowerCase();
  if (/\bpython|fastapi|flask|django\b/.test(text)) return "python-fastapi";
  if (/\bexpress\b|\bapi\b|backend|rest/.test(text) && !/react|frontend|next/.test(text)) return "express-api";
  if (/\bnext\.?js\b|\bnext\b/.test(text)) return "node-fullstack"; // express + SPA frontend (Next runtime needs install+build, express is instant)
  if (/\breact\b|\bvite\b|\bvue\b|\bspa\b|dashboard|saas|app\b/.test(text)) return "vite-react";
  return "static";
}

async function writeAll(projectId: string, files: Record<string, string>, agentRun?: string) {
  for (const [p, content] of Object.entries(files)) {
    if (p.endsWith("/")) {
      await syncedMkdir(projectId, p.slice(0, -1));
    } else {
      await syncedWrite(projectId, p, content, agentRun);
    }
  }
}

export async function scaffoldProject(
  projectId: string,
  kind: ScaffoldKind,
  meta: { name: string; description?: string },
  agentRun?: string
): Promise<{ kind: ScaffoldKind; files: number }> {
  const safeName = meta.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "project";
  switch (kind) {
    case "vite-react":
      await writeAll(projectId, viteReact(safeName, meta.description), agentRun);
      break;
    case "express-api":
      await writeAll(projectId, expressApi(safeName, meta.description), agentRun);
      break;
    case "node-fullstack":
      await writeAll(projectId, nodeFullstack(safeName, meta.description), agentRun);
      break;
    case "python-fastapi":
      await writeAll(projectId, pythonFastapi(safeName, meta.description), agentRun);
      break;
    default:
      await writeAll(projectId, staticSite(safeName, meta.description), agentRun);
  }
  const count = Object.keys(
    kind === "vite-react" ? viteReact(safeName) : kind === "express-api" ? expressApi(safeName) : kind === "node-fullstack" ? nodeFullstack(safeName) : kind === "python-fastapi" ? pythonFastapi(safeName) : staticSite(safeName)
  ).length;
  return { kind, files: count };
}

// ── scaffold templates ─────────────────────────────────────────────────────

function baseReadme(name: string, desc: string, run: string) {
  return `# ${name}\n\n${desc || "Built with Barada Code."}\n\n## Run\n\n\`\`\`bash\n${run}\n\`\`\`\n\n## Structure\n\nProfessional layout — edit freely, Barada keeps it building.\n`;
}

export function viteReact(name: string, desc = ""): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: name.toLowerCase().replace(/\s+/g, "-"),
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
        dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
        devDependencies: {
          "@types/react": "^18.3.3",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.1",
          typescript: "^5.5.3",
          vite: "^5.4.0",
        },
      },
      null,
      2
    ),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2
    ),
    "vite.config.ts": `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()], server: { host: true, port: 5173 } });\n`,
    "index.html": `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    "src/main.tsx": `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    "src/App.tsx": `export default function App() {\n  return (\n    <main className="app">\n      <h1>${name}</h1>\n      <p>Edit src/App.tsx — the preview updates live.</p>\n    </main>\n  );\n}\n`,
    "src/index.css": `:root { font-family: system-ui, sans-serif; }\nbody { margin: 0; background: #0b0d12; color: #eef0f4; }\n.app { max-width: 960px; margin: 0 auto; padding: 48px 24px; }\na { color: #10a35f; }\n`,
    ".env.example": `# Vite exposes only VITE_-prefixed vars to the client\n# VITE_API_URL=http://localhost:3001\n`,
    "README.md": baseReadme(name, desc, "npm install && npm run dev  # http://localhost:5173"),
  };
}

function expressApi(name: string, desc = ""): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: name.toLowerCase().replace(/\s+/g, "-"),
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: { dev: "node server.js", start: "node server.js", test: "node --test" },
        dependencies: { express: "^4.19.2", cors: "^2.8.5" },
      },
      null,
      2
    ),
    "server.js": `import express from "express";\nimport cors from "cors";\n\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\nconst items = [];\n\napp.get("/api/health", (_req, res) => res.json({ ok: true }));\napp.get("/api/items", (_req, res) => res.json(items));\napp.post("/api/items", (req, res) => {\n  const { name } = req.body ?? {};\n  if (!name) return res.status(400).json({ error: "name required" });\n  const item = { id: Date.now(), name };\n  items.push(item);\n  res.status(201).json(item);\n});\n\nconst PORT = process.env.PORT || 3001;\napp.listen(PORT, () => console.log(\`${name} API on :\${PORT}\`));\n`,
    ".env.example": `PORT=3001\n# DATABASE_URL=postgres://...\n`,
    "README.md": baseReadme(name, desc, "npm install && npm run dev  # http://localhost:3001"),
  };
}

function nodeFullstack(name: string, desc = ""): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: name.toLowerCase().replace(/\s+/g, "-"),
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: { dev: "node server.js", start: "node server.js" },
        dependencies: { express: "^4.19.2" },
      },
      null,
      2
    ),
    "server.js": `import express from "express";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst app = express();\napp.use(express.json());\n\n// Simple JSON-file persistence — swap for Prisma/Postgres when needed.\nimport { readFileSync, writeFileSync, existsSync } from "node:fs";\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\nconst DB_FILE = path.join(__dirname, "data", "db.json");\nfunction load() { try { return JSON.parse(readFileSync(DB_FILE, "utf-8")); } catch { return { items: [], users: [] }; } }\nfunction save(db) { writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }\n\napp.get("/api/health", (_req, res) => res.json({ ok: true }));\napp.get("/api/items", (_req, res) => res.json(load().items));\napp.post("/api/items", (req, res) => {\n  const { title } = req.body ?? {};\n  if (!title) return res.status(400).json({ error: "title required" });\n  const db = load();\n  const item = { id: Date.now(), title, done: false, createdAt: new Date().toISOString() };\n  db.items.push(item); save(db);\n  res.status(201).json(item);\n});\napp.patch("/api/items/:id", (req, res) => {\n  const db = load();\n  const item = db.items.find((i) => i.id === Number(req.params.id));\n  if (!item) return res.status(404).json({ error: "not found" });\n  Object.assign(item, req.body);\n  save(db); res.json(item);\n});\napp.delete("/api/items/:id", (req, res) => {\n  const db = load();\n  db.items = db.items.filter((i) => i.id !== Number(req.params.id));\n  save(db); res.json({ ok: true });\n});\n\n// Serve the SPA\nconst pub = path.join(__dirname, "public");\napp.use(express.static(pub));\napp.get(/^\\/(?!api\\/).*/, (_req, res) => res.sendFile(path.join(pub, "index.html")));\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(\`${name} on http://localhost:\${PORT}\`));\n`,
    "public/index.html": `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${name}</title>\n  <link rel="stylesheet" href="/styles.css" />\n</head>\n<body>\n  <main id="app"></main>\n  <script src="/app.js"></script>\n</body>\n</html>\n`,
    "public/styles.css": `:root { font-family: system-ui, sans-serif; }\nbody { margin: 0; background: #0b0d12; color: #eef0f4; }\n#app { max-width: 880px; margin: 0 auto; padding: 40px 20px; }\nbutton { background: #10a35f; border: 0; color: #fff; padding: 10px 18px; border-radius: 10px; cursor: pointer; }\ninput { padding: 10px 14px; border-radius: 10px; border: 1px solid #2a3340; background: #141922; color: inherit; }\n`,
    "public/app.js": `const app = document.getElementById("app");\nlet items = [];\n\nasync function refresh() {\n  items = await (await fetch("/api/items")).json();\n  render();\n}\nfunction render() {\n  app.innerHTML = \`\n    <h1>${name}</h1>\n    <form id="f"><input id="t" placeholder="Add item…" required /><button>Add</button></form>\n    <ul>\` + items.map((i) => \`<li>\${i.title} <button data-del="\${i.id}">×</button></li>\`).join("") + \`</ul>\`;\n  document.getElementById("f").onsubmit = async (e) => {\n    e.preventDefault();\n    const title = document.getElementById("t").value.trim();\n    if (!title) return;\n    await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });\n    refresh();\n  };\n  app.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {\n    await fetch("/api/items/" + b.dataset.del, { method: "DELETE" });\n    refresh();\n  }));\n}\nrefresh();\n`,
    "data/.gitkeep": ``,
    ".env.example": `PORT=3000\n# DATABASE_URL=postgres://...\n`,
    "README.md": baseReadme(name, desc, "npm install && npm run dev  # http://localhost:3000"),
  };
}

function pythonFastapi(name: string, desc = ""): Record<string, string> {
  return {
    "main.py": `from fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\n\napp = FastAPI(title="${name}")\n\nclass Item(BaseModel):\n    title: str\n\ndb: list[dict] = []\n\n@app.get("/api/health")\ndef health():\n    return {"ok": True}\n\n@app.get("/api/items")\ndef list_items():\n    return db\n\n@app.post("/api/items", status_code=201)\ndef create_item(item: Item):\n    entry = {"id": len(db) + 1, **item.model_dump()}\n    db.append(entry)\n    return entry\n`,
    "requirements.txt": `fastapi==0.111.0\nuvicorn==0.30.1\n`,
    ".env.example": `PORT=8000\n`,
    "README.md": baseReadme(name, desc, "pip install -r requirements.txt && uvicorn main:app --reload"),
  };
}

function staticSite(name: string, desc = ""): Record<string, string> {
  return {
    "index.html": `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${name}</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <header><h1>${name}</h1><p>${desc || "A site built with Barada Code."}</p></header>\n  <main id="content"><p>Edit index.html to get started.</p></main>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
    "styles.css": `:root { font-family: system-ui, sans-serif; }\nbody { margin: 0; background: #0b0d12; color: #eef0f4; }\nheader, main { max-width: 900px; margin: 0 auto; padding: 24px 20px; }\n`,
    "script.js": `console.log("${name} ready");\n`,
    "README.md": baseReadme(name, desc, "Open index.html — or let Barada preview it."),
  };
}
