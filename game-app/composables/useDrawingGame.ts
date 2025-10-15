import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useNuxtApp } from '#app'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'
import { sha256 } from 'crypto-hash'
import { getRandomWords, type DifficultyLevel } from '~/utils/wordDictionary'

// Maximum number of players allowed in a game
const MAX_PLAYERS = 8

type Point = { x: number; y: number; t: number }
type Stroke = {
  id: string
  by: string
  color: string
  size: number
  points: Point[]
  at: number
}

type Guess = {
  id: string
  by: string
  displayName: string
  text: string
  at: number
  isCorrect?: boolean
}

type GameState = {
  status: 'waiting' | 'selecting' | 'playing' | 'finished'
  hostId: string | null
  selectedWord: string | null  // Only revealed at end
  wordCommitment: string | null  // Hash commitment
  wordSalt: string | null  // Revealed at end for verification
  wordLength: number | null  // Length of word (safe to reveal)
  wordOptions: string[] | null
  difficulty: DifficultyLevel
  startTime: number | null
  endTime: number | null  // When game actually ended
  duration: number // in seconds (max time limit)
  winnerId: string | null
  winnerName: string | null
  commitmentVerified: boolean | null  // Verification result
  onChainGameId: number | null  // Blockchain game ID (shared by host)
}

// Generate a random bright color for each user
function generateUserColor(): string {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 85%, 65%)`
}

export function useDrawingGame(roomId: string) {
  const { $createYRoom } = useNuxtApp() as any
  const ready = ref(false)
  const userId = ref(`guest-${Math.random().toString(16).slice(2,8)}`)
  const displayName = ref('')
  const brushColor = ref(generateUserColor())
  const brushSize = ref(3)
  
  const gameState = ref<GameState>({
    status: 'waiting',
    hostId: null,
    selectedWord: null,
    wordCommitment: null,
    wordSalt: null,
    wordLength: null,
    wordOptions: null,
    difficulty: 'medium',
    startTime: null,
    endTime: null,
    duration: 180,
    winnerId: null,
    winnerName: null,
    commitmentVerified: null,
    onChainGameId: null
  })
  const timeRemaining = ref(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  // Local state for commit-reveal (not synced to Yjs)
  let localSelectedWord: string | null = null
  let localSalt: string | null = null
  let isVerifying = false // Prevent verification loops

  let yroom: any
  let pending: Point[] = []

  const strokes = ref<Stroke[]>([])
  const peers = ref<any[]>([])
  const guesses = ref<Guess[]>([])

  // Check if current user is the host
  const isHost = computed(() => gameState.value.hostId === userId.value)
  
  // Check if current user can draw
  const canDraw = computed(() => isHost.value && gameState.value.status === 'playing')
  
  // Check if room is full
  const isRoomFull = computed(() => peers.value.length >= MAX_PLAYERS)
  
  // Check if current user can join (already in or room not full)
  const canJoin = computed(() => {
    const isAlreadyIn = peers.value.some(p => p.id === userId.value)
    return isAlreadyIn || !isRoomFull.value
  })

  async function start(roomOpts?: { signaling?: string[]; iceServers?: RTCIceServer[] }) {
    yroom = $createYRoom(roomId, roomOpts)
    
    // Debug logging
    console.log('[DrawingGame] Starting room:', roomId)
    console.log('[DrawingGame] User ID:', userId.value)
    
    // Log provider connection status
    yroom.provider.on('status', (event: any) => {
      console.log('[DrawingGame] Provider status:', event.status || 'initializing')
    })
    
    yroom.provider.on('peers', (event: any) => {
      console.log('[DrawingGame] Connected peers:', event.webrtcPeers)
      console.log('[DrawingGame] Total peers:', event.webrtcPeers.length)
    })
    
    const ygame = yroom.game
    
    // Wait a bit for initial sync before claiming host
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Initialize or load game state
    const existingHost = ygame.get('hostId')
    if (!existingHost) {
      // First user becomes host
      console.log('[DrawingGame] No existing host, becoming host')
      yroom.doc.transact(() => {
        ygame.set('hostId', userId.value)
        ygame.set('status', 'waiting')
        ygame.set('difficulty', 'medium')
        ygame.set('duration', 180)
      })
      gameState.value.hostId = userId.value
    } else {
      // Load existing game state
      console.log('[DrawingGame] Found existing host:', existingHost)
      syncGameState()
    }

    // Listen for game state changes
    ygame.observe(() => {
      syncGameState()
    })

    // awareness: set initial presence
    yroom.awareness.setLocalState({
      id: userId.value, 
      displayName: displayName.value,
      color: brushColor.value, 
      cursor: null,
      isHost: isHost.value
    })

    // react to remote changes
    const rebuild = () => { strokes.value = yroom.strokes.toArray() }
    yroom.strokes.observeDeep(rebuild)
    rebuild()

    // react to guesses
    const guessArray = yroom.doc.getArray('guesses')
    const rebuildGuesses = () => { 
      guesses.value = guessArray.toArray()
      // Only host can check for winners (they have the salt)
      if (isHost.value && gameState.value.status === 'playing' && localSalt) {
        checkForWinner()
      }
    }
    guessArray.observeDeep(rebuildGuesses)
    rebuildGuesses()

    // awareness update
    yroom.awareness.on('change', () => {
      const states = yroom.awareness.getStates()
      
      // Deduplicate peers by user ID (keep the most recent one based on clientID)
      const peerMap = new Map()
      states.forEach((peer: any, clientId: number) => {
        if (peer.id) {
          const existing = peerMap.get(peer.id)
          // Keep the peer with higher clientID (more recent connection)
          if (!existing || clientId > existing.clientId) {
            peerMap.set(peer.id, { ...peer, clientId })
          }
        }
      })
      
      peers.value = Array.from(peerMap.values())
      console.log('[DrawingGame] Awareness changed. Peers:', peers.value.length, peers.value)
      
      // Check if host is still connected
      checkHostPresence()
    })

    // Initial check after a delay (give time for peers to connect)
    setTimeout(() => {
      checkHostPresence()
    }, 1000)

    ready.value = true
  }

  function checkHostPresence() {
    const currentHostId = gameState.value.hostId
    if (!currentHostId) return
    
    // Check if the current host is in the peers list
    const hostPresent = peers.value.some(peer => peer.id === currentHostId)
    
    if (!hostPresent && peers.value.length > 0) {
      // Host disconnected - make the first connected peer the new host
      console.log('Host disconnected, assigning new host')
      const newHostId = peers.value[0].id
      
      // Only update if we're the first peer (to avoid race conditions)
      if (newHostId === userId.value) {
        yroom.game.set('hostId', userId.value)
        console.log('Became new host')
      }
    }
  }

  function syncGameState() {
    const ygame = yroom.game
    gameState.value = {
      status: ygame.get('status') || 'waiting',
      hostId: ygame.get('hostId') || null,
      selectedWord: ygame.get('selectedWord') || null,
      wordCommitment: ygame.get('wordCommitment') || null,
      wordSalt: ygame.get('wordSalt') || null,
      wordLength: ygame.get('wordLength') || null,
      wordOptions: ygame.get('wordOptions') || null,
      difficulty: ygame.get('difficulty') || 'medium',
      startTime: ygame.get('startTime') || null,
      endTime: ygame.get('endTime') || null,
      duration: ygame.get('duration') || 180,
      winnerId: ygame.get('winnerId') || null,
      winnerName: ygame.get('winnerName') || null,
      commitmentVerified: ygame.get('commitmentVerified') || null,
      onChainGameId: ygame.get('onChainGameId') || null
    }

    // Verify commitment when word is revealed (async, non-blocking)
    if (gameState.value.status === 'finished' && gameState.value.selectedWord && gameState.value.wordSalt && !isVerifying) {
      console.log('[DrawingGame] Game finished, verifying commitment...')
      isVerifying = true
      setTimeout(() => verifyCommitment(), 0) // Run async to avoid blocking
    }

    // Start timer if game is playing
    if (gameState.value.status === 'playing' && gameState.value.startTime && !timerInterval) {
      startTimer()
    }
  }

  function generateWordOptions() {
    if (!isHost.value) return
    const words = getRandomWords(gameState.value.difficulty, 3)
    yroom.game.set('wordOptions', words)
    yroom.game.set('status', 'selecting')
  }

  async function selectWord(word: string) {
    if (!isHost.value) return
    
    // Generate random salt
    const salt = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    
    // Normalize the word (lowercase and trim)
    const normalizedWord = word.toLowerCase().trim()
    
    // Create commitment (hash of normalized word + salt)
    const commitment = await sha256(normalizedWord + salt)
    
    // Store locally (not in Yjs yet - this is the "commit" phase)
    localSelectedWord = word
    localSalt = salt
    
    // Broadcast only the commitment and word length, not the word itself
    yroom.game.set('wordCommitment', commitment)
    yroom.game.set('wordLength', word.length) // Safe to reveal length
    yroom.game.set('selectedWord', null) // Don't reveal the word yet
    
    console.log('Word selected:', word, 'Commitment:', commitment.substring(0, 10) + '...')
  }

  function startGame() {
    if (!isHost.value || !localSelectedWord || !gameState.value.wordCommitment) return
    yroom.doc.transact(() => {
      yroom.game.set('status', 'playing')
      yroom.game.set('startTime', Date.now())
      // Clear previous game data
      yroom.strokes.delete(0, yroom.strokes.length)
      const guessArray = yroom.doc.getArray('guesses')
      guessArray.delete(0, guessArray.length)
    })
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval)
    
    timerInterval = setInterval(() => {
      if (!gameState.value.startTime) return
      
      const elapsed = Math.floor((Date.now() - gameState.value.startTime) / 1000)
      const remaining = gameState.value.duration - elapsed
      
      timeRemaining.value = Math.max(0, remaining)
      
      if (remaining <= 0) {
        console.log('[DrawingGame] Time expired! Ending game. isHost:', isHost.value)
        endGame(null, null)
      }
    }, 100)
  }

  async function checkForWinner() {
    if (!gameState.value.wordCommitment || !localSalt) {
      console.log('Cannot check for winner - missing commitment or salt')
      return
    }
    
    console.log('Checking guesses against commitment:', gameState.value.wordCommitment.substring(0, 10) + '...')
    
    // Check each guess against the commitment
    for (const guess of guesses.value) {
      if (guess.isCorrect) continue // Already marked correct
      
      const normalizedGuess = guess.text.toLowerCase().trim()
      const guessHash = await sha256(normalizedGuess + localSalt)
      
      console.log('Guess:', normalizedGuess, 'Hash:', guessHash.substring(0, 10) + '...', 'Match:', guessHash === gameState.value.wordCommitment)
      
      if (guessHash === gameState.value.wordCommitment) {
        // Found the winner!
        console.log('WINNER FOUND:', guess.displayName)
        endGame(guess.by, guess.displayName)
        return
      }
    }
  }

  function endGame(winnerId: string | null, winnerName: string | null) {
    console.log('[DrawingGame] endGame called. winnerId:', winnerId, 'isHost:', isHost.value, 'localWord:', localSelectedWord, 'localSalt:', localSalt?.substring(0, 10))
    
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    
    if (isHost.value) {
      console.log('[DrawingGame] Host ending game, revealing word and salt')
      // Reveal phase: broadcast the word and salt so everyone can verify
      yroom.doc.transact(() => {
        yroom.game.set('status', 'finished')
        yroom.game.set('endTime', Date.now()) // Record when game ended
        yroom.game.set('winnerId', winnerId)
        yroom.game.set('winnerName', winnerName)
        yroom.game.set('selectedWord', localSelectedWord) // Reveal the word
        yroom.game.set('wordSalt', localSalt) // Reveal the salt
      })
    } else {
      console.log('[DrawingGame] Not host, cannot end game')
    }
  }

  async function verifyCommitment() {
    const { wordCommitment, selectedWord, wordSalt } = gameState.value
    if (!wordCommitment || !selectedWord || !wordSalt) return
    
    // Recompute the hash from the revealed word and salt
    const recomputedHash = await sha256(selectedWord.toLowerCase() + wordSalt)
    
    // Check if it matches the original commitment
    const verified = recomputedHash === wordCommitment
    
    // Store verification result
    if (isHost.value) {
      yroom.game.set('commitmentVerified', verified)
    }
    
    gameState.value.commitmentVerified = verified
  }

  function resetGame() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    
    // Clear local state
    localSelectedWord = null
    localSalt = null
    
    yroom.doc.transact(() => {
      // Make the person who clicks "New Game" the new host
      yroom.game.set('hostId', userId.value)
      yroom.game.set('status', 'waiting')
      yroom.game.set('selectedWord', null)
      yroom.game.set('wordCommitment', null)
      yroom.game.set('wordSalt', null)
      yroom.game.set('wordLength', null)
      yroom.game.set('wordOptions', null)
      yroom.game.set('startTime', null)
      yroom.game.set('endTime', null)
      yroom.game.set('winnerId', null)
      yroom.game.set('winnerName', null)
      yroom.game.set('commitmentVerified', null)
      yroom.strokes.delete(0, yroom.strokes.length)
      const guessArray = yroom.doc.getArray('guesses')
      guessArray.delete(0, guessArray.length)
    })
  }

  function addPoint(x: number, y: number) {
    if (!canDraw.value) return
    pending.push({ x, y, t: performance.now() })
  }

  function commitStroke() {
    if (!canDraw.value || !pending.length) return
    const stroke: Stroke = {
      id: nanoid(),
      by: userId.value,
      color: brushColor.value,
      size: brushSize.value,
      points: pending.slice(),
      at: Date.now()
    }
    pending = []
    yroom.doc.transact(() => {
      yroom.strokes.push([stroke])
    })
  }

  function setCursor(pos: { x: number; y: number } | null) {
    // Don't broadcast cursor
    return
  }

  function setDisplayName(name: string) {
    displayName.value = name
    yroom.awareness.setLocalStateField('displayName', name)
  }

  function setWalletAddress(address: string | null) {
    if (!yroom) return
    yroom.awareness.setLocalStateField('walletAddress', address)
  }

  function sendGuess(text: string) {
    if (!text.trim() || gameState.value.status !== 'playing') return
    const guess: Guess = {
      id: nanoid(),
      by: userId.value,
      displayName: displayName.value || 'Anonymous',
      text: text.trim(),
      at: Date.now()
    }
    yroom.doc.transact(() => {
      const guessArray = yroom.doc.getArray('guesses')
      guessArray.push([guess])
    })
  }

  function clearCanvas() {
    if (!isHost.value) return
    yroom.doc.transact(() => {
      yroom.strokes.delete(0, yroom.strokes.length)
    })
  }

  function setDifficulty(difficulty: DifficultyLevel) {
    if (!isHost.value) return
    yroom.game.set('difficulty', difficulty)
  }

  function setDuration(seconds: number) {
    if (!isHost.value) return
    yroom.game.set('duration', seconds)
  }

  function teardown() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    try {
      yroom?.provider?.destroy()
      yroom?.doc?.destroy()
    } catch {}
  }

  onBeforeUnmount(teardown)

  return {
    // state
    ready, strokes, peers, guesses, brushColor, brushSize, userId, displayName,
    isHost, canDraw, gameState, timeRemaining, isRoomFull, canJoin,
    // constants
    maxPlayers: MAX_PLAYERS,
    // api
    start, addPoint, commitStroke, setCursor, setDisplayName, setWalletAddress, sendGuess, clearCanvas,
    generateWordOptions, selectWord, startGame, resetGame, setDifficulty, setDuration,
    // yroom access for SIWE
    getYRoom: () => yroom
  }
}
