/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import wgsl from '@vgpu/wgsl/loader-vite'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [UnoCSS(), vue(), Icons({ compiler: 'vue3' }), wgsl({ minify: true })],
  // Les worktrees des agents (.claude/worktrees) contiennent une copie des tests : on ne les exécute pas depuis l’arbre principal.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
