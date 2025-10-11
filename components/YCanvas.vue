<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

const props = defineProps<{
  strokes: any[],            // from composable (Y.Array -> toArray())
  peers: any[],              // awareness states
  brushColor: string,
  brushSize: number,
  canDraw?: boolean,         // optional: if false, disable drawing
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
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
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
  // Black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)

  // Draw all committed strokes
  for (const s of props.strokes) {
    const pts = s.points
    if (!pts?.length) continue
    ctx.lineWidth = s.size
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = s.color
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
  }

  // Draw current stroke being drawn
  if (drawing && currentStroke.length > 0) {
    ctx.lineWidth = props.brushSize
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = props.brushColor
    ctx.beginPath()
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y)
    for (let i = 1; i < currentStroke.length; i++) {
      ctx.lineTo(currentStroke[i].x, currentStroke[i].y)
    }
    ctx.stroke()
  }

  // draw remote cursors
  if (octx && overlay.value) {
    octx.clearRect(0, 0, overlay.value.width, overlay.value.height)
    for (const st of props.peers) {
      if (!st?.cursor) continue
      octx.beginPath()
      octx.arc(st.cursor.x, st.cursor.y, 4, 0, Math.PI*2)
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
  <div class="relative w-full h-[70vh] border rounded-md overflow-hidden touch-none bg-black">
    <canvas ref="canvas"
      class="absolute inset-0 w-full h-full bg-black"
      :class="{ 'cursor-not-allowed': !canDrawLocal, 'cursor-crosshair': canDrawLocal }"
      @pointerdown.passive="onPointerDown"
      @pointermove.passive="onPointerMove"
      @pointerup.passive="onPointerUp"
      @pointercancel.passive="onPointerUp"
      @pointerleave.passive="onPointerUp"
    />
    <canvas ref="overlay" class="absolute inset-0 w-full h-full pointer-events-none" />
  </div>
</template>
