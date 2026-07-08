import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const githubPagesBase = '/SGHSS-VidaPuls/'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? githubPagesBase : '/',
  plugins: [react()],
})
