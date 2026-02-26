import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useNuxtApp } from '#app'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'
import { sha256 } from 'crypto-hash'
import { getRandomWords, type DifficultyLevel } from '~/utils/wordDictionary'
import { useLogger } from '~/composables/useLogger'

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
  hostEpoch: number  // Monotonically increasing — prevents stale host claims
  hostSetAt: number | null  // Timestamp of last host assignment — detects stale IDB
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
  activePlayerIds: string[] | null  // Players who were in lobby when game started
}

// Generate a random bright color for each user
function generateUserColor(): string {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 85%, 65%)`
}

export function useDrawingGame(roomId: string) {
  const { $createYRoom } = useNuxtApp() as any
  const { addLog } = useLogger()
  const ready = ref(false)
  const userId = ref(`guest-${Math.random().toString(16).slice(2,8)}`)
  const displayName = ref('')
  const brushColor = ref(generateUserColor())
  const brushSize = ref(3)
  
  const gameState = ref<GameState>({
    status: 'waiting',
    hostId: null,
    hostEpoch: 0,
    hostSetAt: null,
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
    onChainGameId: null,
    activePlayerIds: null
  })
  const timeRemaining = ref(0)
  const electionInProgress = ref(false)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  // Progressive hints: array of letters (empty string = hidden)
  const hintLetters = ref<string[]>([])
  let lastHintCount = 0

  // Local state for commit-reveal (not synced to Yjs)
  let localSelectedWord: string | null = null
  let localSalt: string | null = null
  let isVerifying = false // Prevent verification loops

  // Host departure detection
  let hostLastSeenAt = Date.now()

  let yroom: any
  let pending: Point[] = []
  let awarenessInterval: ReturnType<typeof setInterval> | null = null

  const strokes = ref<Stroke[]>([])
  const lobbyStrokes = ref<Stroke[]>([])
  const peers = ref<any[]>([])
  const guesses = ref<Guess[]>([])
  let lobbyPending: Point[] = []

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

  // Spectator: joined after game started or room was full
  const isSpectator = computed(() => {
    const ids = gameState.value.activePlayerIds
    if (!ids) return false // No game in progress or waiting state
    const status = gameState.value.status
    if (status === 'waiting') return false
    return !ids.includes(userId.value)
  })

  // --- Election helpers ---

  /** Read all election candidates from awareness for a given epoch */
  function getCandidatesFromAwareness(epoch: number): Array<{ id: string; at: number }> {
    const states = yroom.awareness.getStates()
    const candidates: Array<{ id: string; at: number }> = []
    states.forEach((state: any) => {
      if (state.id && state.electionClaim && state.electionClaim.epoch === epoch) {
        candidates.push({ id: state.id, at: state.electionClaim.at })
      }
    })
    return candidates
  }

  /** Run an election for the given epoch. All peers who detect a vacancy call this. */
  async function runElection(claimEpoch: number): Promise<{ elected: boolean; hostId: string }> {
    electionInProgress.value = true
    const candidateId = userId.value

    // Broadcast candidacy via awareness (per-peer, can't be overwritten by others)
    yroom.awareness.setLocalStateField('electionClaim', { epoch: claimEpoch, at: Date.now() })

    // Wait for all candidates to broadcast
    const DISPUTE_WINDOW_MS = 1200
    await new Promise(resolve => setTimeout(resolve, DISPUTE_WINDOW_MS))

    // Collect all candidates for this epoch from awareness
    const allCandidates = getCandidatesFromAwareness(claimEpoch)

    // If no candidates (shouldn't happen — we're one), fall back to self
    if (allCandidates.length === 0) {
      allCandidates.push({ id: candidateId, at: Date.now() })
    }

    // Deterministic winner: lowest userId (lexicographic)
    const winner = allCandidates.sort((a, b) => a.id.localeCompare(b.id))[0]

    // Clear our election claim
    yroom.awareness.setLocalStateField('electionClaim', null)

    if (winner.id === candidateId) {
      // We won — commit to Yjs
      yroom.doc.transact(() => {
        yroom.game.set('hostId', candidateId)
        yroom.game.set('hostEpoch', claimEpoch)
        yroom.game.set('hostSetAt', Date.now())
        if (!yroom.game.get('status') || yroom.game.get('status') === 'finished') {
          yroom.game.set('status', 'waiting')
        }
        yroom.game.set('difficulty', yroom.game.get('difficulty') ?? 'medium')
        yroom.game.set('duration', yroom.game.get('duration') ?? 180)
      })
      addLog('Became room host', 'success')
      console.log('[DrawingGame] Election won for epoch', claimEpoch)
    } else {
      addLog(`Joined room (host: ${winner.id.slice(0, 10)}...)`, 'info')
      console.log('[DrawingGame] Election lost, host is', winner.id.slice(0, 10))
    }

    electionInProgress.value = false
    syncGameState()
    return { elected: winner.id === candidateId, hostId: winner.id }
  }

  async function start(roomOpts?: { signaling?: string[]; iceServers?: RTCIceServer[]; [key: string]: any }) {
    yroom = $createYRoom(roomId, roomOpts)

    addLog(`Joining room: ${roomId}`, 'info')
    console.log('[DrawingGame] Starting room:', roomId, 'User:', userId.value)

    const ygame = yroom.game

    // Listen for game state changes (set up before sync so we catch everything)
    ygame.observe(() => {
      syncGameState()
    })

    // awareness: set initial presence (includes electionClaim field)
    yroom.awareness.setLocalState({
      id: userId.value,
      displayName: displayName.value,
      color: brushColor.value,
      cursor: null,
      isHost: false,
      electionClaim: null
    })

    // Wait for initial Yjs sync before deciding on host
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check for existing valid host
    const existingHostId = ygame.get('hostId') as string | null
    const hostSetAt = ygame.get('hostSetAt') as number | null
    const hostEpoch = (ygame.get('hostEpoch') as number | null) ?? 0

    // Detect stale IDB host entries (older than 5 minutes = likely a previous session)
    const SESSION_STALENESS_MS = 5 * 60 * 1000
    const isStale = !hostSetAt || (Date.now() - hostSetAt > SESSION_STALENESS_MS)

    if (existingHostId && !isStale) {
      console.log('[DrawingGame] Found existing host:', existingHostId)
      addLog(`Joined room (host: ${existingHostId.slice(0, 10)}...)`, 'info')
      syncGameState()
    } else {
      // No valid host — run election
      console.log('[DrawingGame] No valid host, running election (stale:', isStale, ')')
      await runElection(hostEpoch + 1)
    }

    // react to remote changes
    const rebuild = () => { strokes.value = yroom.strokes.toArray() }
    yroom.strokes.observeDeep(rebuild)
    rebuild()

    // lobby strokes (separate Y.Array for warm-up doodling)
    const lobbyArray = yroom.doc.getArray('lobbyStrokes')
    const rebuildLobby = () => { lobbyStrokes.value = lobbyArray.toArray() }
    lobbyArray.observeDeep(rebuildLobby)
    rebuildLobby()

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
    let lastPeerCount = 0
    const updatePeers = () => {
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

      const newPeers = Array.from(peerMap.values())
      if (newPeers.length !== lastPeerCount) {
        addLog(`Players: ${newPeers.length}`, 'info')
        lastPeerCount = newPeers.length
      }
      peers.value = newPeers

      // Check if host is still connected
      checkHostPresence()
    }
    yroom.awareness.on('change', updatePeers)
    // Also update when WebRTC peers connect/disconnect (awareness sync may lag)
    yroom.provider.on('peers', () => {
      setTimeout(updatePeers, 200)
    })
    // Read initial states (we may have missed change events during the 500ms sync delay)
    updatePeers()
    // Periodic poll: catch any missed awareness updates (e.g. late-joining peers)
    awarenessInterval = setInterval(updatePeers, 3000)

    ready.value = true
    addLog('Room connected, ready to play', 'success')
  }

  const HOST_DEPARTURE_MS = 12_000 // 12 seconds without awareness heartbeat
  let electionTriggered = false

  function checkHostPresence() {
    const currentHostId = gameState.value.hostId
    if (!currentHostId || currentHostId === userId.value) {
      hostLastSeenAt = Date.now()
      return
    }

    // Check raw awareness for host presence
    const states = yroom.awareness.getStates()
    let hostFound = false
    states.forEach((state: any) => {
      if (state.id === currentHostId) hostFound = true
    })

    if (hostFound) {
      hostLastSeenAt = Date.now()
      electionTriggered = false
      return
    }

    // Host not in awareness — check how long they've been gone
    const silenceDuration = Date.now() - hostLastSeenAt
    if (silenceDuration < HOST_DEPARTURE_MS) return
    if (electionTriggered) return // Already running election for this departure

    // Host confirmed gone — trigger election
    electionTriggered = true
    addLog('Host disconnected, electing new host...', 'warning')
    const currentEpoch = (yroom.game.get('hostEpoch') as number | null) ?? 0
    runElection(currentEpoch + 1).then(result => {
      electionTriggered = false
      if (result.elected) {
        addLog('You are the new host', 'success')
      }
    })
  }

  function syncGameState() {
    const ygame = yroom.game
    gameState.value = {
      status: ygame.get('status') || 'waiting',
      hostId: ygame.get('hostId') || null,
      hostEpoch: ygame.get('hostEpoch') ?? 0,
      hostSetAt: ygame.get('hostSetAt') || null,
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
      onChainGameId: ygame.get('onChainGameId') || null,
      activePlayerIds: ygame.get('activePlayerIds') || null
    }

    // Sync hint letters from Yjs
    hintLetters.value = ygame.get('hintLetters') || []

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
    addLog(`Word selected, commitment: ${commitment.substring(0, 10)}...`, 'info')
  }

  function startGame() {
    if (!isHost.value || !localSelectedWord || !gameState.value.wordCommitment) return
    addLog(`Game started (${gameState.value.duration}s, ${gameState.value.difficulty})`, 'success')
    // Snapshot current players as active participants
    const playerIds = peers.value.map(p => p.id)
    yroom.doc.transact(() => {
      yroom.game.set('status', 'playing')
      yroom.game.set('startTime', Date.now())
      yroom.game.set('activePlayerIds', playerIds)
      // Clear previous game data + lobby doodles
      yroom.strokes.delete(0, yroom.strokes.length)
      const guessArray = yroom.doc.getArray('guesses')
      guessArray.delete(0, guessArray.length)
      const lobbyArray = yroom.doc.getArray('lobbyStrokes')
      lobbyArray.delete(0, lobbyArray.length)
    })
  }

  function updateHints() {
    if (!isHost.value || !localSelectedWord || !gameState.value.startTime) return
    const elapsed = Math.floor((Date.now() - gameState.value.startTime) / 1000)
    const hintsToShow = Math.floor(elapsed / 30)
    const wordLen = localSelectedWord.length

    if (hintsToShow > lastHintCount && lastHintCount < wordLen - 1) {
      // Deterministic shuffle based on commitment
      const seed = gameState.value.wordCommitment || ''
      const indices: number[] = []
      for (let i = 0; i < wordLen; i++) indices.push(i)
      for (let i = indices.length - 1; i > 0; i--) {
        const charCode = seed.charCodeAt(i % seed.length) || 0
        const j = charCode % (i + 1)
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      const maxHints = Math.min(hintsToShow, wordLen - 1)
      lastHintCount = maxHints

      // Build hint array and broadcast via Yjs
      const hints: string[] = Array(wordLen).fill('')
      for (let i = 0; i < maxHints; i++) {
        hints[indices[i]] = localSelectedWord[indices[i]].toLowerCase()
      }
      yroom.game.set('hintLetters', hints)
    }
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval)
    lastHintCount = 0

    timerInterval = setInterval(() => {
      if (!gameState.value.startTime) return

      const elapsed = Math.floor((Date.now() - gameState.value.startTime) / 1000)
      const remaining = gameState.value.duration - elapsed

      timeRemaining.value = Math.max(0, remaining)
      updateHints()

      if (remaining <= 0) {
        console.log('[DrawingGame] Time expired! Ending game. isHost:', isHost.value)
        addLog('Time expired — no winner', 'warning')
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
        addLog(`Winner: ${guess.displayName} guessed correctly!`, 'success')
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
    addLog(`Commitment verification: ${verified ? 'passed' : 'FAILED'}`, verified ? 'success' : 'error')
  }

  async function requestNewGame(): Promise<void> {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    // Clear local state
    localSelectedWord = null
    localSalt = null
    isVerifying = false

    const currentEpoch = (yroom.game.get('hostEpoch') as number | null) ?? 0

    // Reset game data but do NOT set hostId — let election decide
    yroom.doc.transact(() => {
      yroom.game.set('status', 'waiting')
      yroom.game.set('hostId', null)
      yroom.game.set('hostSetAt', null)
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
      yroom.game.set('hintLetters', null)
      yroom.game.set('activePlayerIds', null)
      yroom.strokes.delete(0, yroom.strokes.length)
      const guessArray = yroom.doc.getArray('guesses')
      guessArray.delete(0, guessArray.length)
    })

    // Run election — all peers who click "Play Again" participate
    await runElection(currentEpoch + 1)
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
    if (!text.trim() || gameState.value.status !== 'playing' || isSpectator.value) return
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

  function addLobbyPoint(x: number, y: number) {
    lobbyPending.push({ x, y, t: performance.now() })
  }

  function commitLobbyStroke() {
    if (!lobbyPending.length) return
    const stroke: Stroke = {
      id: nanoid(),
      by: userId.value,
      color: brushColor.value,
      size: brushSize.value,
      points: lobbyPending.slice(),
      at: Date.now()
    }
    lobbyPending = []
    yroom.doc.transact(() => {
      const lobbyArray = yroom.doc.getArray('lobbyStrokes')
      lobbyArray.push([stroke])
    })
  }

  function clearLobbyStrokes() {
    yroom.doc.transact(() => {
      const lobbyArray = yroom.doc.getArray('lobbyStrokes')
      lobbyArray.delete(0, lobbyArray.length)
    })
  }

  function undoStroke() {
    if (!canDraw.value) return
    const len = yroom.strokes.length
    if (len > 0) {
      yroom.doc.transact(() => {
        yroom.strokes.delete(len - 1, 1)
      })
    }
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
    if (awarenessInterval) {
      clearInterval(awarenessInterval)
      awarenessInterval = null
    }
    try {
      yroom?.provider?.destroy()
      yroom?.doc?.destroy()
    } catch {}
  }

  onBeforeUnmount(teardown)

  return {
    // state
    ready, strokes, lobbyStrokes, peers, guesses, brushColor, brushSize, userId, displayName,
    isHost, canDraw, gameState, timeRemaining, isRoomFull, canJoin, isSpectator, hintLetters,
    electionInProgress,
    // constants
    maxPlayers: MAX_PLAYERS,
    // api
    start, addPoint, commitStroke, setCursor, setDisplayName, setWalletAddress, sendGuess,
    undoStroke, clearCanvas, addLobbyPoint, commitLobbyStroke, clearLobbyStrokes,
    generateWordOptions, selectWord, startGame, requestNewGame, resetGame: requestNewGame, setDifficulty, setDuration,
    // yroom access for SIWE
    getYRoom: () => yroom
  }
}
