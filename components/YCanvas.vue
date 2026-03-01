<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

const props = defineProps<{
  strokes: any[],            // from composable (Y.Array -> toArray())
  peers: any[],              // awareness states
  brushColor: string,
  brushSize: number,
  canDraw?: boolean,         // optional: if false, disable drawing
  fillContainer?: boolean,   // if true, fill parent instead of using aspect-ratio
  onPoint: (x:number, y:number) => void,
  onCommit: () => void,
  onCursor: (pos:{x:number;y:number}|null) => void,
}>()

// Default canDraw to true if not provided
const canDrawLocal = computed(() => props.canDraw !== false)

const emit = defineEmits<{
  'update:brushColor': [value: string]
  'update:brushSize': [value: number]
}>()

const localColor = computed({
  get: () => props.brushColor,
  set: (val) => emit('update:brushColor', val)
})

const localSize = computed({
  get: () => props.brushSize,
  set: (val) => emit('update:brushSize', val)
})

const canvas = ref<HTMLCanvasElement|null>(null)
const overlay = ref<HTMLCanvasElement|null>(null)
let ctx: CanvasRenderingContext2D|null = null
let octx: CanvasRenderingContext2D|null = null
let drawing = false
let rafId: number|undefined
let currentStroke: {x: number, y: number}[] = []

function resize() {
  const dpr = window.devicePixelRatio || 1
  for (const c of [canvas.value, overlay.value]) {
    if (!c) continue
    const rect = c.getBoundingClientRect()
    c.width = rect.width
    c.height = rect.height
    const cc = c.getContext('2d')!
    cc.scale(1, 1)
  }
  if (ctx) ctx = canvas.value!.getContext('2d')
  if (octx) octx = overlay.value!.getContext('2d')
  renderAll()
}

function pointerPos(ev: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  const x = ev.clientX - rect.left
  const y = ev.clientY - rect.top
  // Normalize to 0-1 range
  return { 
    x: x / rect.width, 
    y: y / rect.height 
  }
}

function onPointerDown(ev: PointerEvent) {
  if (!canvas.value || !canDrawLocal.value) return
  drawing = true
  currentStroke = []
  const p = pointerPos(ev)
  currentStroke.push(p)
  props.onPoint(p.x, p.y)
  props.onCursor(p)
  renderAll()
}

function onPointerMove(ev: PointerEvent) {
  const p = pointerPos(ev)
  props.onCursor(p)
  if (drawing) {
    currentStroke.push(p)
    props.onPoint(p.x, p.y)
    // throttle rendering via rAF
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = undefined
        renderAll()
      })
    }
  }
}

function onPointerUp() {
  if (!drawing) return
  drawing = false
  currentStroke = []
  props.onCommit()
  props.onCursor(null)
  renderAll()
}

function renderAll() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  
  // Black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  // Draw all committed strokes (scale from normalized 0-1 to canvas size)
  for (const s of props.strokes) {
    const pts = s.points
    if (!pts?.length) continue
    ctx.lineWidth = s.size
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = s.color
    ctx.beginPath()
    ctx.moveTo(pts[0].x * w, pts[0].y * h)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h)
    }
    ctx.stroke()
  }

  // Draw current stroke being drawn (scale from normalized 0-1 to canvas size)
  if (drawing && currentStroke.length > 0) {
    ctx.lineWidth = props.brushSize
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = props.brushColor
    ctx.beginPath()
    ctx.moveTo(currentStroke[0].x * w, currentStroke[0].y * h)
    for (let i = 1; i < currentStroke.length; i++) {
      ctx.lineTo(currentStroke[i].x * w, currentStroke[i].y * h)
    }
    ctx.stroke()
  }

  // draw remote cursors (scale from normalized 0-1 to canvas size)
  if (octx && overlay.value) {
    octx.clearRect(0, 0, overlay.value.width, overlay.value.height)
    for (const st of props.peers) {
      if (!st?.cursor) continue
      octx.beginPath()
      octx.arc(st.cursor.x * w, st.cursor.y * h, 4, 0, Math.PI*2)
      octx.fillStyle = st.color || '#0aa'
      octx.fill()
    }
  }
}

onMounted(() => {
  ctx = canvas.value!.getContext('2d')
  octx = overlay.value!.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
})

watch(() => props.strokes, renderAll, { deep: true })
watch(() => props.peers, renderAll, { deep: true })
</script>

<template>
  <div
    class="relative overflow-hidden touch-none bg-black mx-auto"
    :class="fillContainer ? 'w-full h-full' : 'border rounded-md canvas-constrained'"
  >
    <canvas ref="canvas"
      class="absolute inset-0 w-full h-full bg-black select-none"
      :class="{ 'cursor-not-allowed': !canDrawLocal, 'cursor-crosshair': canDrawLocal }"
      style="user-select: none; -webkit-user-drag: none; -webkit-user-select: none;"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
      @dragstart.prevent
    />
    <canvas ref="overlay" class="absolute inset-0 w-full h-full pointer-events-none" />
  </div>
</template>

<style scoped>
.canvas-constrained {
  aspect-ratio: 16 / 9;
  width: 100%;
  max-height: 80vh;
  max-width: min(100%, calc(80vh * 16 / 9));
}
</style>
