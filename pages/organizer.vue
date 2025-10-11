<template>
  <div>
    <UContainer class="py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">Organizer Dashboard</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Add and manage hackathon projects
        </p>
      </div>

      <!-- Add Project Form -->
      <UCard class="mb-8">
        <template #header>
          <h2 class="text-xl font-semibold">Submit New Project</h2>
        </template>

        <UForm :state="formState" @submit="handleSubmit" class="space-y-4">
          <!-- Project Name -->
          <UFormGroup label="Project Name" required>
            <UInput 
              v-model="formState.name" 
              placeholder="My Awesome Project"
              size="lg"
            />
          </UFormGroup>

          <!-- Description -->
          <UFormGroup label="Description" required>
            <UTextarea 
              v-model="formState.description" 
              placeholder="Describe your project..."
              :rows="4"
            />
          </UFormGroup>

          <!-- Category -->
          <UFormGroup label="Category">
            <USelect 
              v-model="formState.category"
              :options="categories"
              placeholder="Select a category"
            />
          </UFormGroup>

          <!-- Team Members -->
          <UFormGroup label="Team Members">
            <div class="space-y-2">
              <div 
                v-for="(member, index) in (formState.teamMembers || [])" 
                :key="index"
                class="flex gap-2"
              >
                <UInput 
                  v-model="formState.teamMembers![index]" 
                  placeholder="Team member name"
                  class="flex-1"
                />
                <UButton 
                  color="red" 
                  variant="ghost" 
                  icon="i-heroicons-trash"
                  @click="removeMember(index)"
                />
              </div>
              <UButton 
                color="gray" 
                variant="soft" 
                icon="i-heroicons-plus"
                @click="addMember"
                block
              >
                Add Team Member
              </UButton>
            </div>
          </UFormGroup>

          <!-- GitHub URL -->
          <UFormGroup label="GitHub URL">
            <UInput 
              v-model="formState.githubUrl" 
              placeholder="https://github.com/username/repo"
              type="url"
            />
          </UFormGroup>

          <!-- Demo URL -->
          <UFormGroup label="Demo URL">
            <UInput 
              v-model="formState.demoUrl" 
              placeholder="https://demo.example.com"
              type="url"
            />
          </UFormGroup>

          <!-- Submit Button -->
          <div class="flex gap-3 pt-4">
            <UButton 
              type="submit" 
              color="primary"
              size="lg"
              :loading="isSubmitting"
              :disabled="!isFormValid"
            >
              Submit Project
            </UButton>
            <UButton 
              color="gray" 
              variant="ghost"
              size="lg"
              @click="resetForm"
            >
              Reset
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- Existing Projects -->
      <div v-if="projects.length > 0">
        <h2 class="text-2xl font-bold mb-4">Your Projects</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UCard 
            v-for="project in projects" 
            :key="project.id.toString()"
          >
            <template #header>
              <div class="flex items-start justify-between">
                <h3 class="font-semibold">{{ project.parsedMetadata?.name }}</h3>
                <UBadge color="gray" variant="soft">
                  {{ project.votes.toString() }} votes
                </UBadge>
              </div>
            </template>
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {{ project.parsedMetadata?.description }}
            </p>
          </UCard>
        </div>
      </div>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import { useAccount, useWriteContract } from '@wagmi/vue'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '~/lib/contract-config'
import type { ProjectMetadata } from '~/types/project'

const { projects } = useHackathonContract()
const toast = useToast()
const { address } = useAccount()
const { writeContractAsync } = useWriteContract()

const categories = [
  'DeFi',
  'NFT',
  'Gaming',
  'Infrastructure',
  'Social',
  'DAO',
  'Developer Tools',
  'Other'
]

const formState = reactive<ProjectMetadata>({
  name: '',
  description: '',
  category: '',
  teamMembers: [''],
  githubUrl: '',
  demoUrl: '',
})

const isSubmitting = ref(false)

const isFormValid = computed(() => {
  return formState.name.trim() !== '' && formState.description.trim() !== ''
})

const addMember = () => {
  formState.teamMembers?.push('')
}

const removeMember = (index: number) => {
  formState.teamMembers?.splice(index, 1)
}

const resetForm = () => {
  formState.name = ''
  formState.description = ''
  formState.category = ''
  formState.teamMembers = ['']
  formState.githubUrl = ''
  formState.demoUrl = ''
}

const handleSubmit = async () => {
  if (!address.value) {
    toast.add({ title: 'Please connect your wallet', color: 'red' })
    return
  }

  if (!isFormValid.value) {
    toast.add({ title: 'Please fill in required fields', color: 'red' })
    return
  }

  isSubmitting.value = true

  try {
    // Clean up team members (remove empty entries)
    const cleanedMembers = formState.teamMembers?.filter(m => m.trim() !== '') || []
    
    const metadata: ProjectMetadata = {
      name: formState.name,
      description: formState.description,
      category: formState.category || undefined,
      teamMembers: cleanedMembers.length > 0 ? cleanedMembers : undefined,
      githubUrl: formState.githubUrl || undefined,
      demoUrl: formState.demoUrl || undefined,
    }

    const metadataString = JSON.stringify(metadata)

    // Add project to contract
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'addProject',
      args: [metadataString],
    })

    toast.add({ 
      title: 'Project submitted successfully!', 
      description: 'Your project has been added to the hackathon.',
      color: 'green' 
    })

    resetForm()
  } catch (error: any) {
    console.error('Error submitting project:', error)
    toast.add({ 
      title: 'Failed to submit project', 
      description: error?.message || 'Please try again',
      color: 'red' 
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>
