import path from "node:path"

function readPathEnv(name: string) {
  const value = process.env[name]?.trim()

  return value || null
}

export function getRuntimeDataDir() {
  return readPathEnv("VISUALFLOW_DATA_DIR") ?? path.join(process.cwd(), ".local")
}

export function getRuntimePublicDir() {
  return readPathEnv("VISUALFLOW_PUBLIC_DIR") ?? path.join(process.cwd(), "public")
}

export function getRuntimeDataFile(fileName: string) {
  return path.join(getRuntimeDataDir(), fileName)
}

export function getRuntimeGeneratedDir(...segments: string[]) {
  return path.join(getRuntimePublicDir(), "generated", ...segments)
}
