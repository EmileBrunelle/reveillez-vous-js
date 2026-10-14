import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default withVueTs(
  { name: 'rvj/ignores', ignores: ['dist/**', '.claude/**', 'node_modules/**', '**/*.wgsl'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    name: 'rvj/rules',
    rules: {
      // Formatage : laissé à Prettier (voir commit suivant) ; en attendant, on coupe les règles de mise en forme de eslint-plugin-vue.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/html-self-closing': 'off',
      // Noms voulus par le projet (Taskbar, Vigilance…) : pas besoin de forcer des noms composés.
      'vue/multi-word-component-names': 'off',
      // Paramètres préfixés « _ » = volontairement ignorés (stubs d’API à venir).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Convention du projet : fonctions fléchées partout (les générateurs `function*` sont exemptés par la règle).
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
    },
  },
)
