<template>
  <UCard class="project-card group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold truncate">
            {{ project.parsedMetadata?.name || 'Unnamed Project' }}
          </h3>
          <UBadge 
            v-if="project.parsedMetadata?.category" 
            color="primary" 
            variant="soft"
            size="xs"
            class="mt-1"
          >
            {{ project.parsedMetadata.category }}
          </UBadge>
        </div>
        <div class="flex items-center gap-1 text-primary-500">
          <UIcon name="i-heroicons-hand-thumb-up-solid" class="w-5 h-5" />
          <span class="font-bold text-lg">{{ project.votes.toString() }}</span>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Description -->
      <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
        {{ project.parsedMetadata?.description || 'No description provided' }}
      </p>

      <!-- Team Members -->
      <div v-if="project.parsedMetadata?.teamMembers?.length" class="flex flex-wrap gap-1">
        <UBadge
          v-for="(member, idx) in project.parsedMetadata.teamMembers"
          :key="idx"
          color="gray"
          variant="soft"
          size="xs"
        >
          {{ member }}
        </UBadge>
      </div>

      <!-- Links -->
      <div class="flex gap-2">
        <UButton
          v-if="project.parsedMetadata?.githubUrl"
          :to="project.parsedMetadata.githubUrl"
          target="_blank"
          size="xs"
          color="gray"
          variant="ghost"
          icon="i-simple-icons-github"
        >
          Code
        </UButton>
        <UButton
          v-if="project.parsedMetadata?.demoUrl"
          :to="project.parsedMetadata.demoUrl"
          target="_blank"
          size="xs"
          color="gray"
          variant="ghost"
          icon="i-heroicons-arrow-top-right-on-square"
        >
          Demo
        </UButton>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <UButton
          v-if="!hasVoted && isVotingActive"
          color="primary"
          block
          :disabled="!isConnected || isVoting"
          :loading="isVoting"
          @click="handleVote"
        >
          {{ isConnected ? 'Vote' : 'Connect to Vote' }}
        </UButton>
        
        <UButton
          v-else-if="hasVoted && isVotingActive"
          color="gray"
          variant="soft"
          block
          :disabled="isUnvoting"
          :loading="isUnvoting"
          @click="handleUnvote"
        >
          Unvote
        </UButton>

        <UButton
          v-else
          color="gray"
          variant="ghost"
          block
          disabled
        >
          Voting Closed
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { useAccount } from '@wagmi/vue'
import type { ParsedProject } from '~/types/project'

const props = defineProps<{
  project: ParsedProject
  isVotingActive: boolean
}>()

const emit = defineEmits<{
  vote: [projectId: bigint]
  unvote: [projectId: bigint]
}>()

const { address } = useAccount()
const { useHasVoted } = useHackathonContract()

const isConnected = computed(() => !!address.value)
const isVoting = ref(false)
const isUnvoting = ref(false)

// Check if user has voted
const { data: hasVotedData } = useHasVoted(props.project.id)
const hasVoted = computed(() => hasVotedData.value === true)

const handleVote = async () => {
  isVoting.value = true
  try {
    await emit('vote', props.project.id)
  } finally {
    isVoting.value = false
  }
}

const handleUnvote = async () => {
  isUnvoting.value = true
  try {
    await emit('unvote', props.project.id)
  } finally {
    isUnvoting.value = false
  }
}
</script>

<style scoped>
.project-card {
  position: relative;
}

.project-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(
    45deg,
    transparent,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent,
    transparent
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.project-card:hover::before {
  opacity: 1;
  animation: shine 2s ease-in-out infinite;
}

@keyframes shine {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

.project-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.project-card:hover::after {
  opacity: 1;
}
</style>
