// Re-export layer for backward compatibility
// New code should import from ~/utils/wordPacks
export {
  getRandomWords,
  getAllDifficulties,
  getAllPacks,
  getPack,
  type DifficultyLevel,
  type WordPackId,
  type WordPack,
} from './wordPacks'
