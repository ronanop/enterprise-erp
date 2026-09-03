#!/usr/bin/env node
/**
 * Shared path and object-key guards for local Cursor skill scripts.
 * Dev-only utilities — not used by production apps.
 */

const fs = require("fs");
const path = require("path");

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeObjectKey(key) {
  return typeof key === "string" && !UNSAFE_OBJECT_KEYS.has(key) && !key.startsWith("__");
}

function assertWithinRoot(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(resolvedBase + path.sep)
  ) {
    throw new Error(`Refusing path outside allowed root: ${targetPath}`);
  }
  return resolvedTarget;
}

function resolveWithinRoot(baseDir, userPath) {
  if (!userPath || typeof userPath !== "string") {
    throw new Error("Path is required");
  }
  if (path.isAbsolute(userPath)) {
    return assertWithinRoot(baseDir, userPath);
  }
  return assertWithinRoot(baseDir, path.join(baseDir, userPath));
}

function readFileWithinRoot(baseDir, userPath, encoding = "utf-8") {
  const resolved = resolveWithinRoot(baseDir, userPath);
  return fs.readFileSync(resolved, encoding);
}

function writeFileWithinRoot(baseDir, userPath, data) {
  const resolved = resolveWithinRoot(baseDir, userPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, data);
  return resolved;
}

function statWithinRoot(baseDir, userPath) {
  const resolved = resolveWithinRoot(baseDir, userPath);
  return fs.statSync(resolved);
}

function existsWithinRoot(baseDir, userPath) {
  try {
    resolveWithinRoot(baseDir, userPath);
    return fs.existsSync(resolveWithinRoot(baseDir, userPath));
  } catch {
    return false;
  }
}

function safeObjectGet(obj, key) {
  if (!isSafeObjectKey(key)) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function extractSection(content, heading) {
  const marker = `### ${heading}`;
  const start = content.indexOf(marker);
  if (start === -1) return null;
  const next = content.indexOf("\n### ", start + marker.length);
  return next === -1 ? content.slice(start) : content.slice(start, next);
}

module.exports = {
  UNSAFE_OBJECT_KEYS,
  isSafeObjectKey,
  assertWithinRoot,
  resolveWithinRoot,
  readFileWithinRoot,
  writeFileWithinRoot,
  statWithinRoot,
  existsWithinRoot,
  safeObjectGet,
  extractSection,
};
