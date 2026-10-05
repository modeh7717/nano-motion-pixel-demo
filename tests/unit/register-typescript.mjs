// Node strips ordinary TypeScript, but the consolidated providers also contain
// JSX. Compile those files with the project's existing TypeScript dependency;
// keep the built-in test runner and load the real provider/store implementations.
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sourceRoot = new URL("../../src/", import.meta.url);
const navigationUrl = pathToFileURL(require.resolve("next/navigation")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = fileURLToPath(new URL(specifier.slice(2), sourceRoot));
      const file = [".ts", ".tsx", "/index.ts", "/index.tsx"].find((suffix) =>
        existsSync(base + suffix),
      );
      if (file) return nextResolve(pathToFileURL(base + file).href, context);
    }
    // Next supports this extensionless import through its bundler. Node needs
    // the package's actual entry point; no navigation behavior is mocked.
    if (specifier === "next/navigation")
      return nextResolve(navigationUrl, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});
