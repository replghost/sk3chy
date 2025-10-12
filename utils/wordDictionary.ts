// Word dictionaries for the drawing game
export const wordDictionaries = {
  easy: [
    'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'fish', 'bird',
    'apple', 'book', 'chair', 'door', 'flower', 'hat', 'key', 'lamp', 'phone', 'shoe',
    'ball', 'cake', 'cup', 'egg', 'fork', 'glass', 'ice', 'juice', 'kite', 'leaf',
    'milk', 'nest', 'orange', 'pen', 'queen', 'rain', 'snow', 'tent', 'umbrella', 'vase',
    'watch', 'box', 'yarn', 'zebra', 'ant', 'bee', 'cloud', 'duck', 'eye', 'flag'
  ],
  medium: [
    'airplane', 'bicycle', 'camera', 'dragon', 'elephant', 'guitar', 'helicopter', 'island', 'jungle', 'kangaroo',
    'lighthouse', 'mountain', 'notebook', 'octopus', 'penguin', 'rainbow', 'sandwich', 'telescope', 'volcano', 'waterfall',
    'backpack', 'butterfly', 'cactus', 'dinosaur', 'envelope', 'fountain', 'giraffe', 'hamburger', 'igloo', 'jellyfish',
    'keyboard', 'ladder', 'mushroom', 'necklace', 'owl', 'parachute', 'rocket', 'snowman', 'tornado', 'unicorn',
    'violin', 'windmill', 'xylophone', 'yacht', 'zipper', 'anchor', 'balloon', 'castle', 'diamond', 'feather'
  ],
  hard: [
    'astronaut', 'basketball', 'chandelier', 'detective', 'ecosystem', 'fingerprint', 'grandfather clock', 'harmonica', 'imagination', 'jackhammer',
    'kaleidoscope', 'laboratory', 'microscope', 'newspaper', 'observatory', 'photograph', 'quarterback', 'refrigerator', 'scarecrow', 'trampoline',
    'underwater', 'veterinarian', 'wheelbarrow', 'xray machine', 'yo-yo trick', 'zipper jacket', 'acrobat', 'blueprint', 'campfire', 'dashboard',
    'earthquake', 'fireworks', 'greenhouse', 'headphones', 'iceberg', 'jigsaw puzzle', 'karate kick', 'lawnmower', 'mailbox', 'nighttime',
    'orchestra', 'paintbrush', 'quicksand', 'rollercoaster', 'skateboard', 'thunderstorm', 'upside down', 'volleyball', 'watermelon', 'zigzag'
  ],
  phrases: [
    'happy birthday', 'good morning', 'sweet dreams', 'thank you', 'home sweet home',
    'break a leg', 'piece of cake', 'raining cats and dogs', 'under the weather', 'hit the books',
    'break the ice', 'once in a blue moon', 'cost an arm and a leg', 'let the cat out of the bag', 'when pigs fly',
    'bite the bullet', 'spill the beans', 'the best of both worlds', 'see eye to eye', 'hear it through the grapevine',
    'actions speak louder than words', 'add insult to injury', 'back to square one', 'beat around the bush', 'better late than never'
  ]
}

export type DifficultyLevel = keyof typeof wordDictionaries

export function getRandomWords(difficulty: DifficultyLevel, count: number = 3): string[] {
  const dictionary = wordDictionaries[difficulty]
  const shuffled = [...dictionary].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function getAllDifficulties(): DifficultyLevel[] {
  return Object.keys(wordDictionaries) as DifficultyLevel[]
}
