/** Client-safe logging — never prints raw Error objects (CWE-209). */

export function devWarn(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message);
  }
}

export function devError(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.error(message);
  }
}
