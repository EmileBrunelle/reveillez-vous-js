import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import wgsl from '@vgpu/wgsl/loader-vite'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // Alias « @/ » → src/ : déclaré une seule fois, dans les tsconfig (paths), et lu par Vite.
  resolve: { tsconfigPaths: true },
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
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
    setupFiles: ['tests/setup.ts'],
    // Node 25+ expose un `localStorage` global qui avertit (ExperimentalWarning) sans `--localstorage-file` ; les tests utilisent
    // le stockage de happy-dom ou leurs propres doublures, donc on le désactive (option acceptée aussi par Node 22 et 24).
    execArgv: ['--no-experimental-webstorage'],
    // Sur l’exécuteur GitHub seulement, un fichier produit des blocs « stderr » vides (cause non reproduite en local) :
    // un journal sans contenu n’est pas affiché ; tout journal qui contient du texte reste visible.
    onConsoleLog: (log) => (log.trim() === '' ? false : undefined),
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/main.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
})
