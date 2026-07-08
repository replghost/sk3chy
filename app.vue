<template>
  <div class="min-h-screen">
    <NuxtPage v-if="keys.isInHost.value" />
    <div v-else class="fixed inset-0 flex items-center justify-center p-6 text-center">
      <div class="max-w-md space-y-3">
        <h1 class="text-2xl font-bold">sk3chy runs inside the Polkadot app</h1>
        <p class="text-gray-400">
          Open <span class="font-mono text-gray-200">sk3chy-game.dot</span> in the Polkadot
          app to play.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBrowserKeys } from '~/composables/useBrowserKeys'

const keys = useBrowserKeys()

onMounted(() => {
  keys.init()
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
