import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    target: 'es5',
    minify: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: true,
});
