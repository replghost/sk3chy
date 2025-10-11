import { useReadContract, useWriteContract, useAccount } from '@wagmi/vue'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '~/lib/contract-config'
import type { ParsedProject } from '~/types/project'
import { parseProjectMetadata } from '~/types/project'

// Mock data for development
const MOCK_PROJECTS: ParsedProject[] = [
  {
    id: BigInt(1),
    metadata: JSON.stringify({
      name: 'DeFi Swap Protocol',
      description: 'A decentralized exchange protocol with automated market making and liquidity pools. Features low fees, fast swaps, and yield farming opportunities.',
      category: 'DeFi',
      teamMembers: ['Alice Chen', 'Bob Smith', 'Carol Wang'],
      githubUrl: 'https://github.com/example/defi-swap',
      demoUrl: 'https://defi-swap-demo.com',
    }),
    votes: BigInt(42),
    parsedMetadata: {
      name: 'DeFi Swap Protocol',
      description: 'A decentralized exchange protocol with automated market making and liquidity pools. Features low fees, fast swaps, and yield farming opportunities.',
      category: 'DeFi',
      teamMembers: ['Alice Chen', 'Bob Smith', 'Carol Wang'],
      githubUrl: 'https://github.com/example/defi-swap',
      demoUrl: 'https://defi-swap-demo.com',
    },
  },
  {
    id: BigInt(2),
    metadata: JSON.stringify({
      name: 'NFT Marketplace',
      description: 'A next-generation NFT marketplace with social features, creator tools, and cross-chain support. Buy, sell, and discover unique digital assets.',
      category: 'NFT',
      teamMembers: ['David Lee', 'Emma Wilson'],
      githubUrl: 'https://github.com/example/nft-market',
      demoUrl: 'https://nft-market-demo.com',
    }),
    votes: BigInt(38),
    parsedMetadata: {
      name: 'NFT Marketplace',
      description: 'A next-generation NFT marketplace with social features, creator tools, and cross-chain support. Buy, sell, and discover unique digital assets.',
      category: 'NFT',
      teamMembers: ['David Lee', 'Emma Wilson'],
      githubUrl: 'https://github.com/example/nft-market',
      demoUrl: 'https://nft-market-demo.com',
    },
  },
  {
    id: BigInt(3),
    metadata: JSON.stringify({
      name: 'GameFi Arena',
      description: 'Play-to-earn gaming platform where players can compete in tournaments, earn rewards, and trade in-game assets as NFTs.',
      category: 'Gaming',
      teamMembers: ['Frank Zhang', 'Grace Kim', 'Henry Park', 'Iris Chen'],
      githubUrl: 'https://github.com/example/gamefi-arena',
      demoUrl: 'https://gamefi-arena-demo.com',
    }),
    votes: BigInt(55),
    parsedMetadata: {
      name: 'GameFi Arena',
      description: 'Play-to-earn gaming platform where players can compete in tournaments, earn rewards, and trade in-game assets as NFTs.',
      category: 'Gaming',
      teamMembers: ['Frank Zhang', 'Grace Kim', 'Henry Park', 'Iris Chen'],
      githubUrl: 'https://github.com/example/gamefi-arena',
      demoUrl: 'https://gamefi-arena-demo.com',
    },
  },
  {
    id: BigInt(4),
    metadata: JSON.stringify({
      name: 'Social DAO Platform',
      description: 'Decentralized social network governed by its users. Create communities, vote on proposals, and earn tokens for quality content.',
      category: 'DAO',
      teamMembers: ['Jack Brown', 'Kelly Martinez'],
      githubUrl: 'https://github.com/example/social-dao',
    }),
    votes: BigInt(29),
    parsedMetadata: {
      name: 'Social DAO Platform',
      description: 'Decentralized social network governed by its users. Create communities, vote on proposals, and earn tokens for quality content.',
      category: 'DAO',
      teamMembers: ['Jack Brown', 'Kelly Martinez'],
      githubUrl: 'https://github.com/example/social-dao',
    },
  },
  {
    id: BigInt(5),
    metadata: JSON.stringify({
      name: 'Smart Contract Auditor',
      description: 'AI-powered tool for analyzing and auditing smart contracts. Detects vulnerabilities, gas optimization opportunities, and best practice violations.',
      category: 'Developer Tools',
      teamMembers: ['Leo Johnson', 'Maya Patel', 'Nathan Kim'],
      githubUrl: 'https://github.com/example/contract-auditor',
      demoUrl: 'https://contract-auditor-demo.com',
    }),
    votes: BigInt(47),
    parsedMetadata: {
      name: 'Smart Contract Auditor',
      description: 'AI-powered tool for analyzing and auditing smart contracts. Detects vulnerabilities, gas optimization opportunities, and best practice violations.',
      category: 'Developer Tools',
      teamMembers: ['Leo Johnson', 'Maya Patel', 'Nathan Kim'],
      githubUrl: 'https://github.com/example/contract-auditor',
      demoUrl: 'https://contract-auditor-demo.com',
    },
  },
  {
    id: BigInt(6),
    metadata: JSON.stringify({
      name: 'Cross-Chain Bridge',
      description: 'Secure and fast bridge for transferring assets between different blockchain networks. Supports multiple chains and tokens.',
      category: 'Infrastructure',
      teamMembers: ['Olivia Garcia', 'Peter Wong'],
      githubUrl: 'https://github.com/example/cross-chain-bridge',
      demoUrl: 'https://bridge-demo.com',
    }),
    votes: BigInt(33),
    parsedMetadata: {
      name: 'Cross-Chain Bridge',
      description: 'Secure and fast bridge for transferring assets between different blockchain networks. Supports multiple chains and tokens.',
      category: 'Infrastructure',
      teamMembers: ['Olivia Garcia', 'Peter Wong'],
      githubUrl: 'https://github.com/example/cross-chain-bridge',
      demoUrl: 'https://bridge-demo.com',
    },
  },
]

export function useHackathonContract() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const toast = useToast()

  // Read all projects
  const { data: projectsData, refetch: refetchProjects } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getAllProjectsWithVotes',
    query: {
      refetchInterval: 5000, // Refresh every 5 seconds
    },
  })

  // Check if voting is active
  const { data: isVotingActive } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isVotingActive',
    query: {
      refetchInterval: 10000,
    },
  })

  // Parse projects with metadata - use mock data if no real data
  const projects = computed<ParsedProject[]>(() => {
    // If we have real data from the contract, use it
    if (projectsData.value && Array.isArray(projectsData.value) && projectsData.value.length > 0) {
      return (projectsData.value as any[]).map((project) => ({
        id: project.id,
        metadata: project.metadata,
        votes: project.votes,
        parsedMetadata: parseProjectMetadata(project.metadata),
      }))
    }
    // Otherwise, use mock data
    return MOCK_PROJECTS
  })

  // Check if user has voted for a project
  const useHasVoted = (projectId: bigint) => {
    return useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'hasVoted',
      args: address.value && projectId ? [address.value, projectId] : undefined,
      query: {
        enabled: !!address.value && !!projectId,
        refetchInterval: 3000,
      },
    })
  }

  // Vote for a project
  const vote = async (projectId: bigint) => {
    if (!address.value) {
      toast.add({ title: 'Please connect your wallet to vote', color: 'red' })
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'vote',
        args: [projectId],
      })

      toast.add({ title: 'Vote submitted!', color: 'green' })
      await refetchProjects()
      return hash
    } catch (error: any) {
      toast.add({ title: error?.message || 'Failed to vote', color: 'red' })
      throw error
    }
  }

  // Remove vote
  const unvote = async (projectId: bigint) => {
    if (!address.value) {
      toast.add({ title: 'Please connect your wallet', color: 'red' })
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'unvote',
        args: [projectId],
      })

      toast.add({ title: 'Vote removed', color: 'green' })
      await refetchProjects()
      return hash
    } catch (error: any) {
      toast.add({ title: error?.message || 'Failed to unvote', color: 'red' })
      throw error
    }
  }

  return {
    projects,
    isVotingActive,
    useHasVoted,
    vote,
    unvote,
    refetchProjects,
  }
}
