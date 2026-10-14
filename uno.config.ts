import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

// UnoCSS is for NEW components' layout/UI chrome only; existing scoped CSS stays as is.
export default defineConfig({
  presets: [presetWind4({ preflights: { reset: false, theme: 'on-demand' } })],
  // Scan only src/ui/** (new components): scanning legacy files makes words like "fixed"/"flex" in
  // existing code emit stray utilities.
  content: { pipeline: { include: [/\/src\/ui\/.*\.(vue|ts|tsx)($|\?)/] } },
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      bg: 'var(--bg)',
      fg: 'var(--fg)',
      accent: 'var(--accent)',
      alt: 'var(--alt)',
      paper: 'var(--paper)',
      ink: 'var(--ink)',
    },
  },
  shortcuts: {
    'win-window': 'bg-[#c0c0c0] text-black shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_grey,inset_2px_2px_#dfdfdf] p-1',
    'win-btn': 'bg-[#c0c0c0] text-black px-3 py-1 cursor-pointer shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_grey,inset_2px_2px_#dfdfdf] active:shadow-[inset_-1px_-1px_#fff,inset_1px_1px_#0a0a0a,inset_-2px_-2px_#dfdfdf,inset_2px_2px_grey]',
  },
})
