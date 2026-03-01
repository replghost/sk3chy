// BIP-39 Word List - Curated for Drawing Game
// Selected ~600 drawable words from the 2048 BIP-39 word list
// Organized by difficulty and category

export const bip39WordDictionaries = {
  easy: [
    // Animals (30)
    'ant', 'bat', 'bee', 'bird', 'cat', 'cow', 'crab', 'crow', 'deer', 'dog',
    'duck', 'eagle', 'fish', 'fly', 'fox', 'frog', 'goat', 'hawk', 'hen', 'lion',
    'mouse', 'owl', 'pig', 'rat', 'seal', 'swan', 'wasp', 'wolf', 'zebra',
    
    // Nature (35)
    'cave', 'clay', 'cloud', 'corn', 'earth', 'fire', 'fog', 'frost', 'grass', 'hill',
    'ice', 'lake', 'leaf', 'moon', 'oak', 'ocean', 'rain', 'river', 'rock', 'rose',
    'sand', 'sea', 'seed', 'snow', 'soil', 'star', 'stone', 'sun', 'tree', 'wave',
    'wind', 'wood',
    
    // Objects (40)
    'bag', 'ball', 'bell', 'belt', 'bike', 'boat', 'book', 'box', 'brick', 'brush',
    'bulb', 'cage', 'cake', 'can', 'card', 'cart', 'chair', 'clock', 'coin', 'cup',
    'desk', 'doll', 'door', 'drum', 'flag', 'fork', 'gate', 'glass', 'hat', 'key',
    'kite', 'lamp', 'lock', 'mask', 'pen', 'ring', 'rope', 'tent', 'toy', 'vase',
    
    // Food (25)
    'apple', 'bacon', 'bean', 'beef', 'bread', 'butter', 'candy', 'cheese', 'egg', 'fruit',
    'grape', 'honey', 'juice', 'lemon', 'meat', 'milk', 'nut', 'pear', 'rice', 'salt',
    'soup', 'sugar', 'wine',
    
    // Body (20)
    'arm', 'bone', 'brain', 'chest', 'ear', 'eye', 'face', 'foot', 'hair', 'hand',
    'head', 'heart', 'hip', 'knee', 'leg', 'neck', 'nose', 'rib', 'skin', 'toe',
    
    // Actions (25)
    'act', 'add', 'ask', 'call', 'catch', 'chase', 'clap', 'climb', 'cook', 'cry',
    'dance', 'draw', 'drink', 'drive', 'eat', 'fall', 'fly', 'jump', 'kick', 'pull',
    'push', 'run', 'sing', 'swim', 'walk',
    
    // Simple Concepts (25)
    'age', 'air', 'art', 'day', 'end', 'fun', 'game', 'gift', 'home', 'hope',
    'idea', 'job', 'joy', 'life', 'love', 'luck', 'name', 'news', 'note', 'path',
    'plan', 'road', 'room', 'time', 'way'
  ],
  
  medium: [
    // Animals (35)
    'camel', 'coyote', 'dolphin', 'donkey', 'falcon', 'giraffe', 'gorilla', 'hamster', 'hedgehog', 'jaguar',
    'kangaroo', 'kitten', 'leopard', 'lizard', 'lobster', 'monkey', 'ostrich', 'panda', 'panther', 'parrot',
    'pelican', 'penguin', 'pigeon', 'pony', 'puppy', 'rabbit', 'raccoon', 'salmon', 'scorpion', 'spider',
    'squirrel', 'tiger', 'tortoise', 'turkey', 'turtle', 'whale',
    
    // Nature (30)
    'autumn', 'bamboo', 'blossom', 'canyon', 'coral', 'crater', 'crystal', 'desert', 'forest', 'fossil',
    'galaxy', 'garden', 'island', 'jungle', 'meadow', 'mountain', 'orbit', 'planet', 'rainbow', 'season',
    'shadow', 'spring', 'summer', 'sunset', 'thunder', 'valley', 'volcano', 'winter',
    
    // Objects (50)
    'anchor', 'arrow', 'basket', 'blanket', 'bottle', 'bucket', 'button', 'camera', 'candle', 'canvas',
    'carpet', 'castle', 'chimney', 'compass', 'cradle', 'crown', 'cushion', 'curtain', 'diamond', 'engine',
    'fabric', 'feather', 'fence', 'hammer', 'helmet', 'jacket', 'jewel', 'ladder', 'marble', 'medal',
    'mirror', 'needle', 'paddle', 'palace', 'pillow', 'pistol', 'pocket', 'puzzle', 'ribbon', 'rocket',
    'saddle', 'scissors', 'shield', 'shovel', 'silver', 'spoon', 'statue', 'sword', 'table', 'ticket',
    'toilet', 'tower', 'trumpet', 'tunnel', 'umbrella', 'vessel', 'wallet', 'weapon', 'window',
    
    // Food (25)
    'banana', 'burger', 'carrot', 'cereal', 'cherry', 'chicken', 'coconut', 'garlic', 'ginger', 'ketchup',
    'mango', 'muffin', 'mushroom', 'noodle', 'onion', 'orange', 'peanut', 'pepper', 'pizza', 'potato',
    'pumpkin', 'salad', 'sandwich', 'sausage', 'tomato', 'walnut',
    
    // Drawable Actions (40)
    'attack', 'balance', 'borrow', 'capture', 'connect', 'create', 'defend', 'deliver', 'destroy',
    'discover', 'escape', 'explore', 'gather', 'harvest', 'journey', 'launch', 'manage', 'observe',
    'operate', 'perform', 'prepare', 'protect', 'purchase', 'receive', 'recover', 'release', 'remove',
    'repair', 'replace', 'rescue', 'restore', 'retreat', 'reveal', 'rotate', 'scatter', 'search',
    'select', 'settle', 'shelter', 'signal', 'solve', 'struggle', 'support', 'survive', 'swallow',
    'target', 'teach', 'transfer', 'travel', 'update', 'upgrade', 'welcome', 'witness',
    
    // Concrete Concepts (40)
    'airport', 'album', 'anchor', 'arena', 'armor', 'artist', 'auction', 'author', 'banner', 'barrel',
    'battle', 'beauty', 'border', 'bottom', 'cabin', 'cable', 'campus', 'canyon', 'captain', 'cargo',
    'carpet', 'casino', 'castle', 'ceiling', 'center', 'champion', 'chapter', 'cinema', 'citizen', 'closet',
    'cluster', 'college', 'comfort', 'costume', 'country', 'cousin', 'craft', 'crash', 'credit', 'cruise',
    'curtain', 'custom', 'damage', 'danger', 'dentist', 'desert', 'design', 'diamond', 'dinner', 'dinosaur',
    'doctor', 'dragon', 'drama', 'dream', 'driver', 'elephant', 'elevator', 'emotion', 'enemy', 'energy',
    'engine', 'envelope', 'family', 'famous', 'fantasy', 'fashion', 'father', 'favorite', 'feature', 'female',
    'fence', 'festival', 'fiction', 'figure', 'filter', 'finger', 'finish', 'fitness', 'flavor', 'flight',
    'flower', 'focus', 'forest', 'fortune', 'fossil', 'fountain', 'frame', 'friend', 'frontier', 'frozen',
    'funeral', 'furnace', 'future', 'gadget', 'gallery', 'garage', 'garbage', 'garden', 'garment', 'general',
    'genius', 'gentle', 'genuine', 'gesture', 'giant', 'giggle', 'ginger', 'glance', 'glove', 'goddess',
    'gospel', 'gossip', 'gravity', 'grocery', 'growth', 'guard', 'guest', 'guide', 'guitar', 'habit',
    'harbor', 'harmony', 'harvest', 'hazard', 'health', 'heart', 'heaven', 'height', 'hello', 'helmet',
    'hero', 'hidden', 'history', 'hobby', 'hockey', 'holiday', 'hollow', 'honest', 'honor', 'horizon',
    'horror', 'horse', 'hospital', 'hotel', 'hover', 'humble', 'humor', 'hundred', 'hungry', 'hunter',
    'hurdle', 'husband', 'hybrid'
  ],
  
  hard: [
    // Abstract/Difficult Concepts (100+)
    'ability', 'abstract', 'academy', 'accident', 'account', 'acoustic', 'acquire', 'address', 'adjust', 'advance',
    'advice', 'aerobic', 'affair', 'afford', 'agent', 'agree', 'ahead', 'alcohol', 'alert', 'alien',
    'allow', 'almost', 'already', 'alter', 'always', 'amateur', 'amazing', 'among', 'amount', 'amused',
    'analyst', 'ancient', 'anger', 'angle', 'angry', 'announce', 'annual', 'another', 'antenna', 'antique',
    'anxiety', 'apart', 'apology', 'appear', 'approve', 'april', 'arch', 'arctic', 'argue', 'armed',
    'arrange', 'arrest', 'arrive', 'artefact', 'artwork', 'aspect', 'assault', 'asset', 'assist', 'assume',
    'asthma', 'athlete', 'atom', 'attitude', 'attract', 'audit', 'august', 'avocado', 'avoid', 'awake',
    'aware', 'awesome', 'awful', 'awkward', 'axis', 'bachelor', 'badge', 'balcony', 'bamboo', 'barely',
    'basic', 'because', 'become', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'bench',
    'benefit', 'betray', 'better', 'between', 'beyond', 'bicycle', 'biology', 'bitter', 'blade', 'blame',
    'blast', 'bleak', 'bless', 'blind', 'blood', 'blouse', 'board', 'boil', 'bonus', 'boost',
    'boring', 'bounce', 'bracket', 'brand', 'brass', 'brave', 'breeze', 'brief', 'bright', 'bring',
    'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother', 'bubble', 'buddy', 'budget', 'buffalo',
    'build', 'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burst', 'business', 'busy', 'buyer',
    'buzz', 'cabbage', 'cabinet', 'cactus', 'calendar', 'capable', 'category', 'cattle', 'caught', 'caution',
    'celery', 'cement', 'census', 'century', 'certain', 'chalk', 'change', 'chaos', 'charge', 'charity',
    'charter', 'cheap', 'check', 'chef', 'chest', 'chief', 'child', 'choice', 'choose', 'chronic',
    'chuckle', 'chunk', 'churn', 'cigar', 'cinnamon', 'circle', 'civil', 'claim', 'clarify', 'claw',
    'clean', 'clerk', 'clever', 'click', 'client', 'cliff', 'climb', 'clinic', 'clip', 'clog',
    'close', 'cloth', 'clown', 'club', 'clump', 'clutch', 'coach', 'coast', 'code', 'coffee',
    'coil', 'collect', 'color', 'column', 'combine', 'come', 'comic', 'command', 'comment', 'common',
    'company', 'compare', 'compete', 'complex', 'concept', 'concern', 'concert', 'conduct', 'confirm', 'conflict',
    'congress', 'consider', 'consist', 'constant', 'construct', 'consult', 'contact', 'contain', 'content', 'contest',
    'context', 'continue', 'contract', 'contrast', 'control', 'convert', 'convince', 'cook', 'cool', 'copper',
    'copy', 'core', 'correct', 'cost', 'cotton', 'couch', 'couple', 'course', 'cover', 'crack',
    'cradle', 'cram', 'crane', 'crawl', 'crazy', 'cream', 'creek', 'crew', 'cricket', 'crime',
    'crisp', 'critic', 'crop', 'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'crumble', 'crunch',
    'crush', 'culture', 'cupboard', 'curious', 'current', 'curve', 'cycle', 'debate', 'decade', 'decay',
    'decent', 'decide', 'decline', 'decorate', 'decrease', 'defeat', 'define', 'degree', 'delay', 'demand',
    'democracy', 'denial', 'depend', 'deputy', 'derive', 'describe', 'deserve', 'detail', 'detect', 'determine',
    'develop', 'device', 'devote', 'diagram', 'dial', 'diary', 'dice', 'diesel', 'diet', 'differ',
    'digital', 'dignity', 'dilemma', 'diploma', 'direct', 'disagree', 'disaster', 'dismiss', 'disorder', 'dispute',
    'distance', 'distinct', 'district', 'disturb', 'diverse', 'divide', 'divorce', 'dizzy', 'document', 'domain',
    'domestic', 'donate', 'dose', 'double', 'dove', 'draft', 'drastic', 'drift', 'drill', 'drip',
    'drop', 'dry', 'dumb', 'during', 'dust', 'dutch', 'duty', 'dwarf', 'dynamic', 'eager',
    'earn', 'easily', 'east', 'easy', 'echo', 'ecology', 'economy', 'edge', 'edit', 'educate',
    'effort', 'eight', 'either', 'elder', 'elect', 'electric', 'elegant', 'element', 'elite', 'else',
    'embark', 'embody', 'embrace', 'emerge', 'employ', 'empower', 'empty', 'enable', 'enact', 'endless',
    'endorse', 'enforce', 'engage', 'enhance', 'enjoy', 'enlist', 'enough', 'enrich', 'enroll', 'ensure',
    'enter', 'entire', 'entry', 'episode', 'equal', 'equip', 'equity', 'era', 'erase', 'erode',
    'erosion', 'error', 'erupt', 'essay', 'essence', 'estate', 'eternal', 'ethics', 'evidence', 'evil',
    'evoke', 'evolve', 'exact', 'example', 'excess', 'exchange', 'excite', 'exclude', 'excuse', 'execute',
    'exercise', 'exhaust', 'exhibit', 'exile', 'exist', 'exit', 'exotic', 'expand', 'expect', 'expire',
    'explain', 'expose', 'express', 'extend', 'extra', 'eyebrow', 'fabric', 'faculty', 'fade', 'faint',
    'faith', 'fall', 'false', 'fame', 'fancy', 'farm', 'fatal', 'fatigue', 'fault', 'federal',
    'fee', 'feed', 'feel', 'few', 'fiber', 'field', 'file', 'film', 'final', 'finance',
    'find', 'fine', 'firm', 'first', 'fiscal', 'fit', 'fix', 'flame', 'flash', 'flat',
    'flee', 'flip', 'flock', 'flood', 'fluid', 'flush', 'foam', 'fog', 'foil', 'fold',
    'follow', 'food', 'foot', 'force', 'foreign', 'forget', 'forgive', 'fork', 'formal', 'format',
    'formula', 'forum', 'forward', 'foster', 'found', 'fragile', 'frequent', 'fresh', 'fringe', 'frown',
    'fuel', 'fun', 'funny', 'fury', 'gain', 'gap', 'gas', 'gasp', 'gather', 'gauge',
    'gaze', 'genre', 'ghost', 'gift', 'girl', 'give', 'glad', 'glare', 'glide', 'glimpse',
    'globe', 'gloom', 'glory', 'glow', 'glue', 'goat', 'gold', 'good', 'goose', 'govern',
    'gown', 'grab', 'grace', 'grain', 'grant', 'grape', 'grass', 'great', 'green', 'grid',
    'grief', 'grit', 'group', 'grunt', 'guess', 'guilt', 'gun', 'gym', 'hair', 'half',
    'hand', 'happen', 'happy', 'hard', 'harsh', 'have', 'hawk', 'hazard', 'head', 'health',
    'hear', 'heavy', 'hedgehog', 'height', 'help', 'hen', 'hero', 'hidden', 'high', 'hill',
    'hint', 'hip', 'hire', 'history', 'hobby', 'hockey', 'hold', 'hole', 'holiday', 'hollow',
    'home', 'honey', 'hood', 'hope', 'horn', 'horror', 'horse', 'hospital', 'host', 'hotel',
    'hour', 'house', 'hover', 'however', 'hub', 'huge', 'human', 'humble', 'humor', 'hundred',
    'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband', 'hybrid', 'icon', 'idea', 'ideal',
    'identify', 'identity', 'idle', 'ignore', 'ill', 'illegal', 'illness', 'image', 'imitate', 'immense',
    'immune', 'impact', 'impose', 'improve', 'impulse', 'inch', 'include', 'income', 'increase', 'index',
    'indicate', 'indoor', 'industry', 'infant', 'inflict', 'inform', 'inhale', 'inherit', 'initial', 'inject',
    'injury', 'inmate', 'inner', 'innocent', 'input', 'inquiry', 'insane', 'insect', 'inside', 'inspire',
    'install', 'intact', 'interest', 'into', 'invest', 'invite', 'involve', 'iron', 'isolate', 'issue',
    'item', 'ivory', 'jazz', 'jealous', 'jeans', 'jelly', 'job', 'join', 'joke', 'judge',
    'juice', 'jump', 'jungle', 'junior', 'junk', 'just', 'kangaroo', 'keen', 'keep', 'ketchup',
    'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit', 'kitchen', 'kitten', 'kiwi',
    'knee', 'knife', 'knock', 'know', 'lab', 'label', 'labor', 'lady', 'language', 'laptop',
    'large', 'later', 'latin', 'laugh', 'laundry', 'lava', 'law', 'lawn', 'lawsuit', 'layer',
    'lazy', 'leader', 'learn', 'leave', 'lecture', 'left', 'legal', 'legend', 'leisure', 'lend',
    'length', 'lens', 'leopard', 'lesson', 'letter', 'level', 'liar', 'liberty', 'library', 'license',
    'life', 'lift', 'light', 'like', 'limb', 'limit', 'link', 'lion', 'liquid', 'list',
    'little', 'live', 'load', 'loan', 'local', 'lock', 'logic', 'lonely', 'long', 'loop',
    'lottery', 'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber', 'lunar', 'lunch',
    'luxury', 'lyrics', 'machine', 'mad', 'magic', 'magnet', 'maid', 'mail', 'main', 'major',
    'make', 'mammal', 'man', 'mandate', 'mansion', 'manual', 'maple', 'march', 'margin', 'marine',
    'market', 'marriage', 'mass', 'master', 'match', 'material', 'math', 'matrix', 'matter', 'maximum',
    'maze', 'mean', 'mechanic', 'media', 'melody', 'melt', 'member', 'memory', 'mention', 'menu',
    'mercy', 'merge', 'merit', 'merry', 'mesh', 'message', 'metal', 'method', 'middle', 'midnight',
    'military', 'million', 'mimic', 'mind', 'minimum', 'minor', 'minute', 'miracle', 'misery', 'miss',
    'mistake', 'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment', 'monitor', 'monster',
    'month', 'mood', 'moral', 'more', 'morning', 'mosquito', 'mother', 'motion', 'motor', 'mouse',
    'move', 'movie', 'much', 'mule', 'multiply', 'muscle', 'museum', 'music', 'must', 'mutual',
    'myself', 'mystery', 'myth', 'naive', 'napkin', 'narrow', 'nasty', 'nation', 'nature', 'near',
    'need', 'negative', 'neglect', 'neither', 'nephew', 'nerve', 'nest', 'net', 'network', 'neutral',
    'never', 'next', 'nice', 'night', 'noble', 'noise', 'nominee', 'normal', 'north', 'nose',
    'notable', 'note', 'nothing', 'notice', 'novel', 'now', 'nuclear', 'number', 'nurse', 'nut',
    'oak', 'obey', 'object', 'oblige', 'obscure', 'obtain', 'obvious', 'occur', 'october', 'odor',
    'off', 'offer', 'office', 'often', 'oil', 'okay', 'old', 'olive', 'olympic', 'omit',
    'once', 'one', 'online', 'only', 'open', 'opera', 'opinion', 'oppose', 'option', 'orchard',
    'order', 'ordinary', 'organ', 'orient', 'original', 'orphan', 'other', 'outdoor', 'outer', 'output',
    'outside', 'oval', 'oven', 'over', 'own', 'owner', 'oxygen', 'oyster', 'ozone', 'pact',
    'page', 'pair', 'palm', 'panda', 'panel', 'panic', 'paper', 'parade', 'parent', 'park',
    'part', 'party', 'pass', 'patch', 'path', 'patient', 'patrol', 'pattern', 'pause', 'pave',
    'payment', 'peace', 'peasant', 'penalty', 'pencil', 'people', 'perfect', 'permit', 'person', 'pet',
    'phone', 'photo', 'phrase', 'physical', 'piano', 'picnic', 'picture', 'piece', 'pill', 'pilot',
    'pink', 'pioneer', 'pipe', 'pitch', 'place', 'plastic', 'plate', 'play', 'please', 'pledge',
    'pluck', 'plug', 'plunge', 'poem', 'poet', 'point', 'polar', 'pole', 'police', 'pond',
    'pool', 'popular', 'portion', 'position', 'possible', 'post', 'pottery', 'poverty', 'powder', 'power',
    'practice', 'praise', 'prefer', 'present', 'pretty', 'prevent', 'price', 'pride', 'primary', 'print',
    'priority', 'prison', 'private', 'prize', 'problem', 'process', 'produce', 'profit', 'program', 'project',
    'promote', 'proof', 'property', 'prosper', 'proud', 'provide', 'public', 'pudding', 'pull', 'pulp',
    'pulse', 'punch', 'pupil', 'purity', 'purpose', 'purse', 'push', 'put', 'pyramid', 'quality',
    'quantum', 'quarter', 'question', 'quick', 'quit', 'quiz', 'quote', 'race', 'rack', 'radar',
    'radio', 'rail', 'raise', 'rally', 'ramp', 'ranch', 'random', 'range', 'rapid', 'rare',
    'rate', 'rather', 'raven', 'raw', 'razor', 'ready', 'real', 'reason', 'rebel', 'rebuild',
    'recall', 'recipe', 'record', 'recycle', 'reduce', 'reflect', 'reform', 'refuse', 'region', 'regret',
    'regular', 'reject', 'relax', 'relief', 'rely', 'remain', 'remember', 'remind', 'render', 'renew',
    'rent', 'reopen', 'repeat', 'report', 'require', 'resemble', 'resist', 'resource', 'response', 'result',
    'retire', 'return', 'reunion', 'review', 'reward', 'rhythm', 'rib', 'rice', 'rich', 'ride',
    'ridge', 'rifle', 'right', 'rigid', 'ring', 'riot', 'ripple', 'risk', 'ritual', 'rival',
    'road', 'roast', 'robot', 'robust', 'romance', 'roof', 'rookie', 'room', 'rose', 'rough',
    'round', 'route', 'royal', 'rubber', 'rude', 'rug', 'rule', 'run', 'runway', 'rural',
    'sad', 'sadness', 'safe', 'sail', 'salon', 'salt', 'salute', 'same', 'sample', 'sand',
    'satisfy', 'satoshi', 'sauce', 'save', 'say', 'scale', 'scan', 'scare', 'scene', 'scheme',
    'school', 'science', 'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea',
    'season', 'seat', 'second', 'secret', 'section', 'security', 'seed', 'seek', 'segment', 'sell',
    'seminar', 'senior', 'sense', 'sentence', 'series', 'service', 'session', 'setup', 'seven', 'shaft',
    'shallow', 'share', 'shed', 'shell', 'sheriff', 'shift', 'shine', 'ship', 'shiver', 'shock',
    'shoe', 'shoot', 'shop', 'short', 'shoulder', 'shove', 'shrimp', 'shrug', 'shuffle', 'shy',
    'sibling', 'sick', 'side', 'siege', 'sight', 'sign', 'silent', 'silk', 'silly', 'similar',
    'simple', 'since', 'siren', 'sister', 'situate', 'six', 'size', 'skate', 'sketch', 'ski',
    'skill', 'skirt', 'skull', 'slab', 'slam', 'sleep', 'slender', 'slice', 'slide', 'slight',
    'slim', 'slogan', 'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke', 'smooth',
    'snack', 'snake', 'snap', 'sniff', 'soap', 'soccer', 'social', 'sock', 'soda', 'soft',
    'solar', 'soldier', 'solid', 'solution', 'someone', 'song', 'soon', 'sorry', 'sort', 'soul',
    'sound', 'source', 'south', 'space', 'spare', 'spatial', 'spawn', 'speak', 'special', 'speed',
    'spell', 'spend', 'sphere', 'spice', 'spike', 'spin', 'spirit', 'split', 'spoil', 'sponsor',
    'sport', 'spot', 'spray', 'spread', 'square', 'squeeze', 'stable', 'stadium', 'staff', 'stage',
    'stairs', 'stamp', 'stand', 'start', 'state', 'stay', 'steak', 'steel', 'stem', 'step',
    'stereo', 'stick', 'still', 'sting', 'stock', 'stomach', 'stool', 'story', 'stove', 'strategy',
    'street', 'strike', 'strong', 'student', 'stuff', 'stumble', 'style', 'subject', 'subway', 'success',
    'such', 'sudden', 'suffer', 'suggest', 'suit', 'sunny', 'super', 'supply', 'supreme', 'sure',
    'surface', 'surge', 'surprise', 'survey', 'suspect', 'swamp', 'swap', 'swarm', 'swear', 'sweet',
    'swift', 'swing', 'switch', 'symptom', 'syrup', 'system', 'tackle', 'tag', 'tail', 'talent',
    'talk', 'tank', 'tape', 'task', 'taste', 'tattoo', 'taxi', 'team', 'tell', 'tenant',
    'tennis', 'term', 'test', 'text', 'thank', 'that', 'theme', 'then', 'theory', 'there',
    'they', 'thing', 'this', 'thought', 'three', 'thrive', 'throw', 'thumb', 'ticket', 'tide',
    'tilt', 'timber', 'tiny', 'tip', 'tired', 'tissue', 'title', 'toast', 'tobacco', 'today',
    'toddler', 'together', 'token', 'tomorrow', 'tone', 'tongue', 'tonight', 'tool', 'tooth', 'topic',
    'topple', 'torch', 'tornado', 'toss', 'total', 'tourist', 'toward', 'town', 'track', 'trade',
    'traffic', 'tragic', 'train', 'trap', 'trash', 'tray', 'treat', 'trend', 'trial', 'tribe',
    'trick', 'trim', 'trip', 'trophy', 'trouble', 'truck', 'true', 'truly', 'trust', 'truth',
    'try', 'tube', 'tuition', 'tumble', 'tuna', 'turn', 'twelve', 'twenty', 'twice', 'twin',
    'twist', 'two', 'type', 'typical', 'ugly', 'unable', 'unaware', 'uncle', 'uncover', 'under',
    'undo', 'unfair', 'unfold', 'unhappy', 'uniform', 'unique', 'unit', 'universe', 'unknown', 'unlock',
    'until', 'unusual', 'unveil', 'upon', 'upper', 'upset', 'urban', 'urge', 'usage', 'use',
    'used', 'useful', 'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valve',
    'van', 'vanish', 'vapor', 'various', 'vast', 'vault', 'vehicle', 'velvet', 'vendor', 'venture',
    'venue', 'verb', 'version', 'very', 'veteran', 'viable', 'vibrant', 'vicious', 'video', 'view',
    'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual', 'vital', 'vivid', 'vocal',
    'voice', 'void', 'volume', 'vote', 'wage', 'wagon', 'wait', 'walk', 'wall', 'want',
    'warfare', 'warm', 'warrior', 'wash', 'waste', 'water', 'way', 'wealth', 'wear', 'weasel',
    'weather', 'web', 'wedding', 'weekend', 'weird', 'west', 'wet', 'what', 'wheat', 'wheel',
    'when', 'where', 'whip', 'whisper', 'wide', 'width', 'wife', 'wild', 'will', 'win',
    'wine', 'wing', 'wink', 'winner', 'winter', 'wire', 'wisdom', 'wise', 'wish', 'wolf',
    'woman', 'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry', 'worth', 'wrap',
    'wreck', 'wrestle', 'wrist', 'write', 'wrong', 'yard', 'year', 'yellow', 'you', 'young',
    'youth', 'zero', 'zone', 'zoo'
  ]
}

export type Bip39DifficultyLevel = keyof typeof bip39WordDictionaries

export function getRandomBip39Words(difficulty: Bip39DifficultyLevel, count: number = 3): string[] {
  const dictionary = bip39WordDictionaries[difficulty]
  const shuffled = [...dictionary].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function getAllBip39Difficulties(): Bip39DifficultyLevel[] {
  return Object.keys(bip39WordDictionaries) as Bip39DifficultyLevel[]
}

// Stats
export const bip39Stats = {
  easy: bip39WordDictionaries.easy.length,
  medium: bip39WordDictionaries.medium.length,
  hard: bip39WordDictionaries.hard.length,
  total: bip39WordDictionaries.easy.length + bip39WordDictionaries.medium.length + bip39WordDictionaries.hard.length
}
