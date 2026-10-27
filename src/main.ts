import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/im-fell-english/latin-400.css'
import '@fontsource/im-fell-english/latin-400-italic.css'
import '@fontsource/cinzel/latin-700.css'
import 'virtual:uno.css'
import './styles.css'
import App from './App.vue'
import { createAppLocale } from './locale'

createApp(App).use(createPinia()).use(createAppLocale()).mount('#app')
