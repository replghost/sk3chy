import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useNuxtApp } from '#app'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'

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
}

// Generate a random bright color for each user
function generateUserColor(): string {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 85%, 65%)`
}

export function useYPictionary(roomId: string) {
  const { $createYRoom } = useNuxtApp() as any
  const ready = ref(false)
  const userId = ref(`guest-${Math.random().toString(16).slice(2,8)}`)
  const displayName = ref('')
  const brushColor = ref(generateUserColor())
  const brushSize = ref(3)
  const hostId = ref<string | null>(null)

  let yroom: any
  let pending: Point[] = []
  let rafId: number | null = null

  const strokes = ref<Stroke[]>([])
  const peers = ref<any[]>([])
  const guesses = ref<Guess[]>([])

  // Check if current user is the host
  const isHost = computed(() => hostId.value === userId.value)
  
  // Check if current user can draw
  const canDraw = computed(() => isHost.value)

  function start(roomOpts?: { signaling?: string[]; iceServers?: RTCIceServer[] }) {
    yroom = $createYRoom(roomId, roomOpts)
    
    // Check if there's already a host
    const gameState = yroom.game
    const existingHost = gameState.get('hostId')
    
    if (!existingHost) {
      // This user is the first one - make them the host
      gameState.set('hostId', userId.value)
      hostId.value = userId.value
    } else {
      hostId.value = existingHost
    }

    // Listen for host changes
    gameState.observe(() => {
      hostId.value = gameState.get('hostId')
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
    const guessArray = yroom.doc.getArray<Guess>('guesses')
    const rebuildGuesses = () => { guesses.value = guessArray.toArray() }
    guessArray.observeDeep(rebuildGuesses)
    rebuildGuesses()

    // awareness update (cursors)
    yroom.awareness.on('change', () => {
      peers.value = Array.from(yroom.awareness.getStates().values())
    })

    ready.value = true
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
    if (!canDraw.value) return
    yroom.awareness.setLocalStateField('cursor', pos)
  }

  function setDisplayName(name: string) {
    displayName.value = name
    yroom.awareness.setLocalStateField('displayName', name)
  }

  function sendGuess(text: string) {
    if (!text.trim()) return
    const guess: Guess = {
      id: nanoid(),
      by: userId.value,
      displayName: displayName.value || 'Anonymous',
      text: text.trim(),
      at: Date.now()
    }
    yroom.doc.transact(() => {
      const guessArray = yroom.doc.getArray<Guess>('guesses')
      guessArray.push([guess])
    })
  }

  function clearCanvas() {
    if (!canDraw.value) return
    yroom.doc.transact(() => {
      yroom.strokes.delete(0, yroom.strokes.length)
    })
  }

  function clearGuesses() {
    if (!canDraw.value) return
    yroom.doc.transact(() => {
      const guessArray = yroom.doc.getArray<Guess>('guesses')
      guessArray.delete(0, guessArray.length)
    })
  }

  function teardown() {
    try {
      yroom?.provider?.destroy()
      yroom?.doc?.destroy()
    } catch {}
  }

  onBeforeUnmount(teardown)

  return {
    // state
    ready, strokes, peers, guesses, brushColor, brushSize, userId, displayName,
    isHost, canDraw, hostId,
    // api
    start, addPoint, commitStroke, setCursor, setDisplayName, sendGuess, clearCanvas, clearGuesses
  }
}
