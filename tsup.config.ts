import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/discord/deploy-commands.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
});
