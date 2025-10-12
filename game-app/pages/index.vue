<template>
  <div>
    <UContainer class="py-16">
      <div class="flex flex-col items-center justify-center gap-8">
        <h1 class="text-4xl font-bold text-center">Welcome to Hackathon Voting</h1>

        <UCard class="w-full max-w-2xl">
          <template #header>
            <h2 class="text-2xl font-semibold">Getting Started</h2>
          </template>
          
          <div class="space-y-4">
            <p>This is your hackathon voting application built with Nuxt and NuxtUI.</p>
            
            <div class="flex flex-wrap gap-3">
              <UButton color="primary" size="lg" to="/projects">
                View Projects
              </UButton>
              <UButton 
                color="gray" 
                variant="outline" 
                size="lg"
                icon="i-heroicons-plus-circle"
                @click="showAddProjectModal = true"
              >
                Add Project
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-8">
          <UCard>
            <div class="text-center">
              <div class="text-3xl font-bold">{{ projects.length }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Projects</div>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <div class="text-3xl font-bold">{{ totalVotes }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Votes</div>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <UBadge 
                :color="isVotingActive ? 'green' : 'gray'" 
                variant="subtle"
                size="lg"
                class="text-lg"
              >
                {{ isVotingActive ? 'Active' : 'Closed' }}
              </UBadge>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Voting Status</div>
            </div>
          </UCard>
        </div>
      </div>
    </UContainer>

    <!-- Add Project Modal -->
    <AddProjectModal 
      v-model="showAddProjectModal"
      @success="handleProjectAdded"
    />
  </div>
</template>

<script setup lang="ts">
const { projects, isVotingActive, refetchProjects } = useHackathonContract()
const showAddProjectModal = ref(false)

const totalVotes = computed(() => {
  return projects.value.reduce((sum, project) => sum + Number(project.votes), 0)
})

const handleProjectAdded = () => {
  refetchProjects()
}
</script>
