// AC-265: the root pnpm-lock.yaml keeps every package at or above the
// version that fixed its known high or critical security issue.
// Run: node --test tests/security/pnpm_floors.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))

// package -> lowest safe version (per major line where it matters)
const FLOORS = {
  braces: "3.0.3",
  "decode-uri-component": "0.5.1",
  "serialize-javascript": "7.0.3",
  lodash: "4.18.0",
  vite: "7.3.7",
  "shell-quote": "1.11.0",
  "@grpc/grpc-js": "1.13.6",
  "source-map-js": "1.2.2",
  zod: "4.6.6",
  undici: { 7: "7.30.1" },
}

export const cmp = (a, b) => {
  const x = a.split(/[.+-]/).map(Number)
  const y = b.split(/[.+-]/).map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0)
  return 0
}

// Versions of each package in the lock's "packages:" section.
export const lockedVersions = (text) => {
  const section = text.split(/^packages:\s*$/m)[1]?.split(/^snapshots:\s*$/m)[0] ?? ""
  const out = {}
  for (const m of section.matchAll(/^ {2}'?((?:@[^@/\s]+\/)?[^@\s']+)@(\d[^:(\s']*)/gm)) {
    ;(out[m[1]] ??= new Set()).add(m[2])
  }
  return out
}

export const below = (versions) => {
  const bad = []
  for (const [name, floor] of Object.entries(FLOORS)) {
    for (const v of versions[name] ?? []) {
      const f = typeof floor === "string" ? floor : floor[v.split(".")[0]]
      if (f && cmp(v, f) < 0) bad.push(`${name}@${v} (< ${f})`)
    }
  }
  return bad
}

test("cmp orders versions", () => {
  assert.ok(cmp("1.12.0", "1.9.0") > 0)
  assert.ok(cmp("4.17.23", "4.18.0") < 0)
  assert.equal(cmp("7.3.7", "7.3.7"), 0)
})

test("lockedVersions reads the packages section only", () => {
  const sample = "packages:\n\n  '@grpc/grpc-js@1.9.0':\n    resolution: {}\n  vite@7.3.1:\n    x: 1\n\nsnapshots:\n\n  lodash@4.17.0:\n"
  const v = lockedVersions(sample)
  assert.deepEqual([...v["@grpc/grpc-js"]], ["1.9.0"])
  assert.deepEqual([...v.vite], ["7.3.1"])
  assert.equal(v.lodash, undefined)
  assert.deepEqual(below(v).sort(), ["@grpc/grpc-js@1.9.0 (< 1.13.6)", "vite@7.3.1 (< 7.3.7)"])
})

test("root pnpm-lock.yaml has no package under its security floor", () => {
  const v = lockedVersions(readFileSync(`${root}pnpm-lock.yaml`, "utf8"))
  assert.ok(Object.keys(v).length > 100, "lock parsed")
  assert.deepEqual(below(v), [])
})

test("the unmaintained cpx 1.x is gone (cpx2 gives the same cpx command)", () => {
  const v = lockedVersions(readFileSync(`${root}pnpm-lock.yaml`, "utf8"))
  assert.equal(v.cpx, undefined)
  assert.ok(v.cpx2, "cpx2 locked")
})

test("one spessasynth_core, so player and app share its types", () => {
  const v = lockedVersions(readFileSync(`${root}pnpm-lock.yaml`, "utf8"))
  assert.equal(v.spessasynth_core?.size, 1)
})
