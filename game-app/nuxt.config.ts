import { defineNuxtConfig } from 'nuxt/config'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
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
      substrateRpcHttp: process.env.NUXT_PUBLIC_SUBSTRATE_RPC_HTTP || 'https://services.polkadothub-rpc.com/testnet',
      substrateRpcWs: process.env.NUXT_PUBLIC_SUBSTRATE_RPC_WS || 'wss://sys.ibp.network/asset-hub-paseo',
      substrateChain: process.env.NUXT_PUBLIC_SUBSTRATE_CHAIN || 'paseo-asset-hub',
      substrateChainName: process.env.NUXT_PUBLIC_SUBSTRATE_CHAIN_NAME || 'Paseo Asset Hub',
      substrateChainId: process.env.NUXT_PUBLIC_SUBSTRATE_CHAIN_ID || '420420417',
      substrateDappName: process.env.NUXT_PUBLIC_SUBSTRATE_DAPP_NAME || 'sk3chy',
      peopleChainWs: process.env.NUXT_PUBLIC_PEOPLE_CHAIN_WS
        || process.env.NUXT_PUBLIC_STATEMENT_STORE_WS
        || 'wss://pop3-testnet.parity-lab.parity.io/people'
    }
  }
})
