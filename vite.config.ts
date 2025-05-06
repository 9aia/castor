import { defineConfig } from 'vite';
import path from 'path';
import dts from 'vite-plugin-dts'

export default defineConfig({
    build: {
        target: 'esnext',
        lib: {
            entry: {
                'castor-sdk': path.resolve(__dirname, 'src/sdk.ts'),
                'castor-cli': path.resolve(__dirname, 'src/cli.ts'),
                'castor-bin': path.resolve(__dirname, 'src/bin.js'),
            },
            name: 'Castor',
            fileName: (format, entryName) => `${entryName}.${format}.js`,
            formats: ['es'],
        },
        outDir: 'dist',
        rollupOptions: {
            external: [
                'drizzle-orm',
                'zod',
                'fast-glob',
                'node:fs',
                'node:url',
                'node:path',
                'node:child_process',
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
    plugins: [dts({
        rollupTypes: true,
    })]
});
