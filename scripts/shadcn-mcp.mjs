import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/web")
process.chdir(root)

const child = spawn("npx", ["-y", "shadcn@latest", "mcp"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
