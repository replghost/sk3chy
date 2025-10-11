<template>
    <div>
      <UContainer class="py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2">Peers</h1>

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
  