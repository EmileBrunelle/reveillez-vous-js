import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import wgsl from '@vgpu/wgsl/loader-vite'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [UnoCSS(), vue(), Icons({ compiler: 'vue3' }), wgsl({ minify: true })],
})
