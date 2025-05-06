#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const distPath = path.resolve(__dirname, 'castor-cli.es.js')

spawn('tsx', [distPath], {
  stdio: 'inherit',
})
