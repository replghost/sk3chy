import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useNuxtApp } from '#app'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'

type Point = { x: number; y: number; t: number }
type Stroke = {
  id: string
  by: string            // some user id (random for demo)
  color: string
  size: number
  points: Point[]
  at: number
}

// Generate a random bright color for each user
function generateUserColor(): string {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 85%, 65%)`
}

export function useYDrawing(roomId: string) {
  const { $createYRoom } = useNuxtApp() as any
  const ready = ref(false)
  const userId = ref(`guest-${Math.random().toString(16).slice(2,8)}`)
  const displayName = ref('')
  const brushColor = ref(generateUserColor())
  const brushSize = ref(3)

  let yroom: any
  let pending: Point[] = []
  let rafId: number | null = null

  const strokes = ref<Stroke[]>([])
  const peers = ref<any[]>([]) // awareness states

  function start(roomOpts?: { signaling?: string[]; iceServers?: RTCIceServer[] }) {
    yroom = $createYRoom(roomId, roomOpts)
    // awareness: set initial presence
    yroom.awareness.setLocalState({
      id: userId.value, 
      displayName: displayName.value,
      color: brushColor.value, 
      cursor: null
    })

    // react to remote changes
    const rebuild = () => { strokes.value = yroom.strokes.toArray() }
    yroom.strokes.observeDeep(rebuild)
    rebuild()

    // awareness update (cursors)
    yroom.awareness.on('change', () => {
      peers.value = Array.from(yroom.awareness.getStates().values())
    })

    ready.value = true
  }

  function addPoint(x: number, y: number) {
    pending.push({ x, y, t: performance.now() })
  }

  function commitStroke() {
    if (!pending.length) return
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
    yroom.awareness.setLocalStateField('cursor', pos)
  }

  function setDisplayName(name: string) {
    displayName.value = name
    yroom.awareness.setLocalStateField('displayName', name)
  }

  function clearCanvas() {
    yroom.doc.transact(() => {
      yroom.strokes.delete(0, yroom.strokes.length)
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
    ready, strokes, peers, brushColor, brushSize, userId, displayName,
    // api
    start, addPoint, commitStroke, setCursor, setDisplayName, clearCanvas
  }
}
