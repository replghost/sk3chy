<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    
    <main class="flex-1">
      <NuxtPage />
    </main>
    
    <AppFooter />
  </div>
</template>

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

@media (prefers-color-scheme: light) {
  :root {
    background-color: #fafafa;
    color: #171717;
  }
}
</style>
