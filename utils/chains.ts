import { defineChain } from 'viem'

export const passetHub = defineChain({
  id: 420420421,
  name: 'Polkadot Asset Hub Testnet',
  network: 'passet-hub-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'DOT',
    symbol: 'DOT',
  },
  rpcUrls: {
    default: {
      http: [
        'https://testnet-passet-hub-eth-rpc.polkadot.io',
        // Add fallback RPCs here if available
      ],
    },
    public: {
      http: [
        'https://testnet-passet-hub-eth-rpc.polkadot.io',
        // Add fallback RPCs here if available
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'BlockScout',
      url: 'https://blockscout-passet-hub.parity-testnet.parity.io',
    },
  },
  testnet: true,
})
