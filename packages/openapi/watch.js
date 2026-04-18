#!/usr/bin/env node
/**
 * Watch API source files and regenerate OpenAPI types on change
 * Usage: node watch.js
 */

import { spawn } from "child_process";
import { watch } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiPath = join(__dirname, "../../apps/api");
const modulesPath = join(apiPath, "modules");

let isGenerating = false;
let pendingGeneration = false;

async function waitForApi(maxAttempts = 30) {
  console.log("[openapi:watch] Waiting for API to be ready...");

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch("http://localhost:8080/openapi/json");
      if (response.ok) {
        console.log("[openapi:watch] API is ready");
        return true;
      }
    } catch {
      // API not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("API did not become ready in time");
}

async function generateTypes() {
  if (isGenerating) {
    pendingGeneration = true;
    return;
  }

  isGenerating = true;
  console.log("[openapi:watch] Generating types...");

  try {
    const result = spawn(
      "npx",
      [
        "openapi-typescript",
        "http://localhost:8080/openapi/json",
        "-o",
        "lib/schema.gen.d.ts",
      ],
      {
        cwd: __dirname,
        stdio: "inherit",
        shell: true,
      },
    );

    await new Promise((resolve, reject) => {
      result.on("close", (code) => {
        if (code === 0) {
          console.log("[openapi:watch] Types generated successfully");
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error("[openapi:watch] Failed to generate types:", error.message);
  } finally {
    isGenerating = false;
    if (pendingGeneration) {
      pendingGeneration = false;
      generateTypes();
    }
  }
}

// Debounce function
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

const debouncedGenerate = debounce(generateTypes, 500);

async function start() {
  // Wait for API to be ready
  await waitForApi();

  // Initial generation
  await generateTypes();

  console.log("[openapi:watch] Watching for changes...");
  console.log(`[openapi:watch] Modules path: ${modulesPath}`);

  // Watch the modules directory
  const watcher = watch(
    modulesPath,
    { recursive: true },
    (eventType, filename) => {
      if (filename && filename.endsWith(".ts")) {
        console.log(`[openapi:watch] ${eventType}: ${filename}`);
        debouncedGenerate();
      }
    },
  );

  // Also watch main.ts
  watch(join(apiPath, "main.ts"), debouncedGenerate);

  // Cleanup on exit
  process.on("SIGINT", () => {
    console.log("\n[openapi:watch] Stopping watcher...");
    watcher.close();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error("[openapi:watch] Failed to start:", error.message);
  process.exit(1);
});
