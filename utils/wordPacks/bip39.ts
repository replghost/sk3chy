import type { WordPack } from './index'
import { bip39WordDictionaries } from '../bip39WordDictionary'

export const bip39Pack: WordPack = {
  id: 'bip39',
  name: 'BIP-39',
  description: 'Crypto OG mode',
  icon: '🔑',
  words: bip39WordDictionaries,
}
