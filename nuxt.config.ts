import { defineNuxtConfig } from 'nuxt/config'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  app: {
    // Product archives are served from host-controlled paths, so product builds
    // set NUXT_APP_BASE_URL=./ to keep Nuxt chunks relative to index.html.
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  modules: ['@nuxt/ui', '@wagmi/vue/nuxt'],
  vite: {
    plugins: [wasm(), topLevelAwait()],
    server: {
      // Allow cross-origin requests when embedded in a host app iframe
      cors: true,
    },
    optimizeDeps: {
      // Prevent stale dep cache errors when loaded in a cross-origin iframe
      force: true,
    },
  },
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('dc-')
    }
  },
  ssr: false, // Enable SPA mode
  runtimeConfig: {
    public: {
      statementStoreWs: process.env.NUXT_PUBLIC_STATEMENT_STORE_WS || 'wss://previewnet.substrate.dev/people',
      statementStoreSigningMode: process.env.NUXT_PUBLIC_STATEMENT_STORE_SIGNING || 'mnemonic',
      turnUsername: process.env.NUXT_PUBLIC_TURN_USERNAME || '',
      turnCredential: process.env.NUXT_PUBLIC_TURN_CREDENTIAL || '',
      contractAddress: process.env.NUXT_PUBLIC_CONTRACT_ADDRESS || '0x0CdDBa8De3211cDB5f3b039F0e4B892fc189E6E1',
      pinataJwt: process.env.NUXT_PUBLIC_PINATA_JWT || '',
      pinataJwtRead: process.env.NUXT_PUBLIC_PINATA_JWT_READ || '',
      pinataGateway: process.env.NUXT_PUBLIC_PINATA_GATEWAY || '',
      nftContractAddress: process.env.NUXT_PUBLIC_NFT_CONTRACT_ADDRESS || '',
      substrateRpcHttp: process.env.NUXT_PUBLIC_SUBSTRATE_RPC_HTTP || 'https://paseo-asset-hub-next-rpc.polkadot.io',
      substrateRpcWs: process.env.NUXT_PUBLIC_SUBSTRATE_RPC_WS || 'wss://paseo-asset-hub-next-rpc.polkadot.io',
      substrateGenesisHash: process.env.NUXT_PUBLIC_SUBSTRATE_GENESIS_HASH || '0xbf0488dbe9daa1de1c08c5f743e26fdc2a4ecd74cf87dd1b4b1eeb99ae4ef19f',
      substrateSs58Prefix: process.env.NUXT_PUBLIC_SUBSTRATE_SS58_PREFIX || '42',
      substrateChain: process.env.NUXT_PUBLIC_SUBSTRATE_CHAIN || 'paseo-asset-hub-next-v2',
      substrateChainName: process.env.NUXT_PUBLIC_SUBSTRATE_CHAIN_NAME || 'Paseo Next v2 Asset Hub',
      substrateChainId: process.env.NUXT_PUBLIC_SUBSTRATE_CHAIN_ID || '420420417',
      substrateDappName: process.env.NUXT_PUBLIC_SUBSTRATE_DAPP_NAME || 'sk3chy',
      productDotNs: process.env.NUXT_PUBLIC_PRODUCT_DOTNS || '',
      peopleChainWs: process.env.NUXT_PUBLIC_PEOPLE_CHAIN_WS
        || process.env.NUXT_PUBLIC_STATEMENT_STORE_WS
        || 'wss://pop3-testnet.parity-lab.parity.io/people'
    }
  }
})
