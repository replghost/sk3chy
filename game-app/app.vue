<template>
  <div class="min-h-screen">
    <AppHeader />
    <NuxtPage />
    <AppFooter />
    <OnboardingModal v-model="showOnboarding" />
  </div>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const keys = useBrowserKeys()
const showOnboarding = useState('showOnboarding', () => false)

onMounted(() => {
  keys.init()
  if (keys.isInHost.value) {
    // In Spektr host — identity provided by host, skip onboarding
    showOnboarding.value = false
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
