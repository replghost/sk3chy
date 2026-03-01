// Import BIP-39 word dictionaries
import { bip39WordDictionaries, bip39Stats } from './bip39WordDictionary'

// Use BIP-39 words for the game!
export const wordDictionaries = bip39WordDictionaries

export type DifficultyLevel = keyof typeof wordDictionaries

// Fisher-Yates shuffle for proper randomization
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function getRandomWords(difficulty: DifficultyLevel, count: number = 3): string[] {
  const dictionary = wordDictionaries[difficulty]
  const shuffled = shuffle(dictionary)
  return shuffled.slice(0, count)
}

export function getAllDifficulties(): DifficultyLevel[] {
  return Object.keys(wordDictionaries) as DifficultyLevel[]
}

// Export stats for debugging/info
export { bip39Stats as wordStats }
