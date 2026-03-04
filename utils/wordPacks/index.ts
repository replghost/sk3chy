export type DifficultyLevel = 'easy' | 'medium' | 'hard'
export type WordPackId = 'classic' | 'popCulture' | 'blockchain' | 'action' | 'bip39'

export interface WordPack {
  id: WordPackId
  name: string
  description: string
  icon: string
  words: Record<DifficultyLevel, string[]>
}

import { classicPack } from './classic'
import { popCulturePack } from './popCulture'
import { blockchainPack } from './blockchain'
import { actionPack } from './action'
import { bip39Pack } from './bip39'

const registry: Record<WordPackId, WordPack> = {
  classic: classicPack,
  popCulture: popCulturePack,
  blockchain: blockchainPack,
  action: actionPack,
  bip39: bip39Pack,
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function getRandomWords(packId: WordPackId, difficulty: DifficultyLevel, count: number = 3): string[] {
  const pack = registry[packId] || registry.classic
  const dictionary = pack.words[difficulty]
  return shuffle(dictionary).slice(0, count)
}

export function getAllPacks(): WordPack[] {
  return Object.values(registry)
}

export function getPack(id: WordPackId): WordPack {
  return registry[id] || registry.classic
}

export function getAllDifficulties(): DifficultyLevel[] {
  return ['easy', 'medium', 'hard']
}
