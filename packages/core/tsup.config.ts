import { defineConfig } from 'tsup';
import { Plugin } from "esbuild";

const filePlugin = {
  name: "file",
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, async (args) => {
      const fs = await import("fs/promises");
      const content = await fs.readFile(args.path, "utf8");
      return {
        contents: `export default ${JSON.stringify(content)}`,
        loader: "js",
      };
    });
  },
};


export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  format: ['esm'], // Ensure you're targeting CommonJS
  external: [
    'dotenv', // Externalize dotenv to prevent bundling
    'fs', // Externalize fs to use Node.js built-in module
    'path', // Externalize other built-ins if necessary
    'http',
    'https',
    // Add other modules you want to externalize
  ],

  esbuildPlugins: [
    filePlugin
  ]
});
