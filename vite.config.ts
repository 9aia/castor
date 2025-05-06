import { defineConfig } from 'vite';
import path from 'path';
import dts from 'vite-plugin-dts'

export default defineConfig({
    build: {
        target: 'esnext',
        lib: {
            entry: {
                'sdk': path.resolve(__dirname, 'src/sdk.ts'),
                'cli': path.resolve(__dirname, 'main.ts'),
            },
            name: 'Castor',
            fileName: (format, entryName) => `castor-${entryName}.${format}.js`,
            formats: ['es'],
        },
        outDir: 'dist',
        rollupOptions: {
            external: [
                'drizzle-orm',
                'zod',
                'fast-glob',
                'node:fs',
                'node:path',
                'wrangler',
                'enquirer',
            ],
        },
    },
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'src'),
        },
    },
    plugins: [dts()]
});
