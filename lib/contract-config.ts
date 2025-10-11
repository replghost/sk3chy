export const CONTRACT_ADDRESS = (process.env.NUXT_PUBLIC_CONTRACT_ADDRESS || '0xE8906EF095FeFfA9b43b81Dd14B08b4da929B1C0') as `0x${string}`

export const CONTRACT_ABI = [
  // Project Management
  {
    type: 'function',
    name: 'addProject',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'metadata', type: 'string' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAllProjectsWithVotes',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'metadata', type: 'string' },
          { name: 'votes', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isVotingActive',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'vote',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unvote',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasVoted',
    stateMutability: 'view',
    inputs: [
      { name: 'voter', type: 'address' },
      { name: 'projectId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const
