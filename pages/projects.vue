<template>
  <div>
    <UContainer class="py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">Hackathon Projects</h1>
        <div class="flex flex-col md:flex-row md:items-center gap-4">
          <div class="flex items-center gap-4">
            <UBadge 
              :color="isVotingActive ? 'green' : 'gray'" 
              variant="subtle"
              size="lg"
            >
              {{ isVotingActive ? '🟢 Voting Active' : '⚫ Voting Closed' }}
            </UBadge>
            <p class="text-gray-600 dark:text-gray-400">
              {{ filteredProjects.length }} {{ filteredProjects.length === 1 ? 'project' : 'projects' }}
            </p>
          </div>
          
          <!-- Category Filter -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
            <UButton
              :variant="selectedCategory === null ? 'solid' : 'ghost'"
              size="xs"
              @click="selectedCategory = null"
            >
              All
            </UButton>
            <UButton
              v-for="category in categories"
              :key="category"
              :variant="selectedCategory === category ? 'solid' : 'ghost'"
              size="xs"
              @click="selectedCategory = category"
            >
              {{ category }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="!filteredProjects.length" class="text-center py-16">
        <UIcon name="i-heroicons-inbox" class="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p class="text-gray-500 dark:text-gray-400">
          {{ selectedCategory ? `No ${selectedCategory} projects yet` : 'No projects yet' }}
        </p>
      </div>

      <!-- Projects Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProjectCard
          v-for="project in sortedProjects"
          :key="project.id.toString()"
          :project="project"
          :is-voting-active="isVotingActive || false"
          @vote="handleVote"
          @unvote="handleUnvote"
        />
      </div>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import type { ParsedProject } from '~/types/project'

const { projects, isVotingActive, vote, unvote } = useHackathonContract()

const selectedCategory = ref<string | null>(null)

// Get unique categories from projects
const categories = computed(() => {
  const cats = new Set<string>()
  projects.value.forEach(project => {
    if (project.parsedMetadata?.category) {
      cats.add(project.parsedMetadata.category)
    }
  })
  return Array.from(cats).sort()
})

// Filter projects by selected category
const filteredProjects = computed(() => {
  if (!selectedCategory.value) {
    return projects.value
  }
  return projects.value.filter(project => 
    project.parsedMetadata?.category === selectedCategory.value
  )
})

// Sort filtered projects by votes (descending)
const sortedProjects = computed(() => {
  return [...filteredProjects.value].sort((a, b) => {
    return Number(b.votes - a.votes)
  })
})

const handleVote = async (projectId: bigint) => {
  await vote(projectId)
}

const handleUnvote = async (projectId: bigint) => {
  await unvote(projectId)
}
</script>
