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
      contractAddress: process.env.NUXT_PUBLIC_CONTRACT_ADDRESS || '0x0CdDBa8De3211cDB5f3b039F0e4B892fc189E6E1',
      pinataJwt: process.env.NUXT_PUBLIC_PINATA_JWT || '',
      pinataGateway: process.env.NUXT_PUBLIC_PINATA_GATEWAY || '',
      nftContractAddress: process.env.NUXT_PUBLIC_NFT_CONTRACT_ADDRESS || ''
    }
  }
})
