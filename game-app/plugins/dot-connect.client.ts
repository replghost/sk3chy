import { defineConfig } from '@reactive-dot/core'
import { InjectedWalletProvider } from '@reactive-dot/core/wallets.js'
import { registerDotConnect } from 'dot-connect'
import 'dot-connect/font.css'
import { defineNuxtPlugin } from '#app'

const config = defineConfig({
  wallets: [new InjectedWalletProvider()]
})

registerDotConnect({ wallets: config.wallets ?? [] })

export default defineNuxtPlugin(() => {})
