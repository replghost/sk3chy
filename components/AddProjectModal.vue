<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">Submit New Project</h3>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            @click="closeModal"
          />
        </div>
      </template>

      <UForm :state="formState" @submit="handleSubmit" class="space-y-4">
        <!-- Project Name -->
        <UFormGroup label="Project Name" required>
          <UInput 
            v-model="formState.name" 
            placeholder="My Awesome Project"
          />
        </UFormGroup>

        <!-- Description -->
        <UFormGroup label="Description" required>
          <UTextarea 
            v-model="formState.description" 
            placeholder="Describe your project..."
            :rows="3"
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
                size="sm"
              />
              <UButton 
                color="red" 
                variant="ghost" 
                icon="i-heroicons-trash"
                size="sm"
                @click="removeMember(index)"
              />
            </div>
            <UButton 
              color="gray" 
              variant="soft" 
              icon="i-heroicons-plus"
              size="sm"
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
      </UForm>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton 
            color="gray" 
            variant="ghost"
            @click="closeModal"
          >
            Cancel
          </UButton>
          <UButton 
            color="primary"
            :loading="isSubmitting"
            :disabled="!isFormValid"
            @click="handleSubmit"
          >
            Submit Project
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { useAccount, useWriteContract } from '@wagmi/vue'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '~/lib/contract-config'
import type { ProjectMetadata } from '~/types/project'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

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
  if (!formState.teamMembers) {
    formState.teamMembers = []
  }
  formState.teamMembers.push('')
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

const closeModal = () => {
  isOpen.value = false
  resetForm()
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
    await writeContractAsync({
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

    emit('success')
    closeModal()
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
