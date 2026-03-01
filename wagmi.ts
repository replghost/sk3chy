import { cookieStorage, createConfig, createStorage, http, injected } from '@wagmi/vue'
import { mainnet, optimism, sepolia } from '@wagmi/vue/chains'
import { passetHub } from '~/utils/chains'

export const config = createConfig({
  chains: [passetHub, mainnet, sepolia, optimism],
  connectors: [
    injected(),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [passetHub.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
  },
})

declare module '@wagmi/vue' {
  interface Register {
    config: typeof config
  }
}
