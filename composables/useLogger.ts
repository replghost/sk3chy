import { ref } from 'vue'
import type { LogType, LogEntry } from '~/lib/ss-webrtc/types'

const MAX_LOGS = 200

const EMOJI_MAP: Record<LogType, string> = {
  error: '\u274C',
  success: '\u2705',
  blockchain: '\u26D3\uFE0F',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
}

// Module-level singleton
const logs = ref<LogEntry[]>([])

function addLog(message: string, type: LogType = 'info') {
  const entry: LogEntry = {
    timestamp: new Date(),
    message,
    type,
  }

  const emoji = EMOJI_MAP[type] || ''
  console.log(`${emoji} [${type}] ${message}`)

  logs.value.push(entry)

  // Cap at MAX_LOGS
  if (logs.value.length > MAX_LOGS) {
    logs.value = logs.value.slice(-MAX_LOGS)
  }
}

function clearLogs() {
  logs.value = []
}

export function useLogger() {
  return {
    logs,
    addLog,
    clearLogs,
  }
}
