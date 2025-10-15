// Import BIP-39 word dictionaries
import { bip39WordDictionaries, bip39Stats } from './bip39WordDictionary'

// Use BIP-39 words for the game!
export const wordDictionaries = bip39WordDictionaries

export type DifficultyLevel = keyof typeof wordDictionaries

export function getRandomWords(difficulty: DifficultyLevel, count: number = 3): string[] {
  const dictionary = wordDictionaries[difficulty]
  const shuffled = [...dictionary].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function getAllDifficulties(): DifficultyLevel[] {
  return Object.keys(wordDictionaries) as DifficultyLevel[]
}

// Export stats for debugging/info
export { bip39Stats as wordStats }
