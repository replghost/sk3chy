import { defineNuxtConfig } from 'nuxt/config'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@wagmi/vue/nuxt'],
  ssr: false, // Enable SPA mode
  runtimeConfig: {
    public: {
      signalingServer: process.env.NUXT_PUBLIC_SIGNALING_SERVER || 'ws://localhost:4444',
      turnUsername: process.env.NUXT_PUBLIC_TURN_USERNAME || '',
      turnCredential: process.env.NUXT_PUBLIC_TURN_CREDENTIAL || '',
    }
  }
})
