import { mount } from 'svelte'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './styles/global.css'
import App from './App.svelte'
import { registerSW } from 'virtual:pwa-register'

// 'prompt' mode with no prompt UI: an update waits for the next visit instead
// of reloading mid-session.
registerSW({ immediate: true })

mount(App, { target: document.getElementById('app') })
