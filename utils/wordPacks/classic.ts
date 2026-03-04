import type { WordPack } from './index'

export const classicPack: WordPack = {
  id: 'classic',
  name: 'Classic',
  description: 'Standard Pictionary words',
  icon: '🎨',
  words: {
    easy: [
      // Animals
      'cat', 'dog', 'fish', 'bird', 'frog', 'snake', 'pig', 'cow', 'duck', 'rabbit',
      'mouse', 'horse', 'bear', 'shark', 'butterfly',
      // Food
      'pizza', 'banana', 'apple', 'ice cream', 'hamburger', 'hotdog', 'cake', 'cookie',
      'donut', 'egg',
      // Objects
      'umbrella', 'guitar', 'clock', 'candle', 'balloon', 'chair', 'lamp', 'book',
      'phone', 'key', 'hat', 'shoe', 'cup', 'door', 'bed',
      // Nature
      'sun', 'moon', 'star', 'tree', 'flower', 'rain', 'snowman', 'mountain',
      'cloud', 'rainbow',
    ],
    medium: [
      // Scenes / compound concepts
      'birthday cake', 'haunted house', 'roller coaster', 'astronaut', 'mermaid',
      'pirate ship', 'treasure chest', 'fire truck', 'scarecrow', 'lighthouse',
      'hot air balloon', 'palm tree', 'igloo', 'campfire', 'waterfall',
      'traffic light', 'windmill', 'robot', 'tornado', 'volcano',
      'parachute', 'suitcase', 'telescope', 'stethoscope', 'anchor',
      'birdhouse', 'catapult', 'compass', 'crown', 'dinosaur',
      'dragon', 'ferris wheel', 'gingerbread man', 'hammock', 'jukebox',
      'kite', 'lawnmower', 'megaphone', 'oil lamp', 'paper airplane',
      'rocking chair', 'skateboard', 'snowglobe', 'totem pole', 'treehouse',
      'unicycle', 'waffle iron', 'xylophone', 'zipline', 'bunk bed',
      'chandelier', 'diving board', 'electric guitar', 'fire hydrant', 'grandfather clock',
    ],
    hard: [
      // Abstract but drawable
      'time travel', 'photobomb', 'domino effect', 'trojan horse', 'avalanche',
      'brain freeze', 'deja vu', 'free fall', 'goldilocks', 'jack of all trades',
      'karma', 'leap of faith', 'mind reader', 'night owl', 'oasis',
      'pandora\'s box', 'quicksand', 'renaissance', 'stampede', 'tug of war',
      'underdog', 'voodoo doll', 'wrecking ball', 'x-ray', 'yo-yo champion',
      'zero gravity', 'bermuda triangle', 'chain reaction', 'double agent', 'evolution',
      'food chain', 'global warming', 'ice age', 'jailbreak', 'labyrinth',
      'magic carpet', 'north pole', 'optical illusion', 'parallel universe', 'relay race',
      'sinking ship', 'time zone', 'urban legend', 'vanishing act', 'witch hunt',
      'identity theft', 'musical chairs', 'paper trail', 'shadow puppet', 'sleepwalking',
    ],
  },
}
