<template>
  <div class="min-h-screen">
    <AppHeader v-if="!keys.isInHost.value" />
    <NuxtPage />
    <AppFooter v-if="!keys.isInHost.value" />
    <OnboardingModal
      v-model="showOnboarding"
      :require-on-chain="onboardingRequireOnChain"
      :chain-endpoint="onboardingChainEndpoint"
    />
  </div>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const keys = useBrowserKeys()
const showOnboarding = useState('showOnboarding', () => false)
const onboardingRequireOnChain = useState('onboardingRequireOnChain', () => false)
const onboardingChainEndpoint = useState('onboardingChainEndpoint', () => '')

onMounted(() => {
  keys.init()
  if (keys.isInHost.value) {
    // In iframe — assume host provides identity, skip onboarding.
    // If Spektr handshake fails, the play page falls back to WebRTC,
    // so show onboarding as fallback if no username is set.
    showOnboarding.value = false
    watch(keys.spektrInitFailed, (failed) => {
      if (failed && !keys.username.value) {
        showOnboarding.value = true
      }
    })
  } else if (!keys.username.value) {
    showOnboarding.value = true
  }
})
</script>

<style>
:root {
  background-color: #0f0f0f;
  color: #e5e5e5;
  color-scheme: dark;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  font-synthesis: none;
  font-weight: 400;
  line-height: 1.5;
  text-rendering: optimizeLegibility;

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

html, body {
  overflow: hidden;
  height: 100%;
  height: 100dvh;
}
</style>
