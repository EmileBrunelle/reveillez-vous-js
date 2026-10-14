import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [presetWind4({ preflights: { reset: false, theme: 'on-demand' } })],
  // Tout src/ (.vue et .ts); les ids de Vite peuvent porter un suffixe ?query.
  content: { pipeline: { include: [/\/src\/.*\.(vue|ts)($|\?)/] } },
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
    btn: '[font:inherit] cursor-pointer px-[1.1rem] py-[0.7rem] [background:var(--accent)] [color:var(--ink)] border-[3px] border-solid [border-color:var(--fg)] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:[outline-color:var(--fg)] focus-visible:outline-offset-2',
    'btn-alt': '[font:inherit] cursor-pointer px-[1.1rem] py-[0.7rem] [background:var(--alt)] [color:var(--ink)] border-[3px] border-solid [border-color:var(--fg)] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:[outline-color:var(--fg)] focus-visible:outline-offset-2',
    bar: 'w-full h-6 border-[3px] border-solid [border-color:var(--fg)]',
    linklike: '[font:inherit] [background:none] border-0 p-0 [color:inherit] underline cursor-pointer focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:[outline-color:var(--accent)] focus-visible:outline-offset-2',
    scene: 'w-full max-w-[36rem] grid gap-[1.25rem] justify-items-center text-center',
    lead: 'm-0 text-[1.15rem] leading-[1.5]',
    'win-window': 'bg-[#c0c0c0] text-black shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_grey,inset_2px_2px_#dfdfdf] p-1',
    'win-btn': 'bg-[#c0c0c0] text-black px-3 py-1 cursor-pointer shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_grey,inset_2px_2px_#dfdfdf] active:shadow-[inset_-1px_-1px_#fff,inset_1px_1px_#0a0a0a,inset_-2px_-2px_#dfdfdf,inset_2px_2px_grey]',
  },
})
