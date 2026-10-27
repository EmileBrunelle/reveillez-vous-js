import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import wgsl from '@vgpu/wgsl/loader-vite'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    UnoCSS(),
    vue(),
    Icons({
      compiler: 'vue3',
      customCollections: { rvj: FileSystemIconLoader('./src/assets/svg') },
      // Nos SVG se dimensionnent par CSS : « unset » supprime le width/height 1.2em injecté par défaut (collection rvj seulement, game-icons garde sa taille).
      iconCustomizer: (collection, _icon, props) => {
        if (collection === 'rvj') {
          props.width = 'unset'
          props.height = 'unset'
        }
      },
    }),
    wgsl({ minify: true }),
  ],
  // Les worktrees des agents (.claude/worktrees) contiennent une copie des tests : on ne les exécute pas depuis l’arbre principal.
  test: { exclude: [...configDefaults.exclude, '.claude/**'], setupFiles: ['tests/setup.ts'] },
})
