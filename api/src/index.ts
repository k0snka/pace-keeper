import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { API_SECRET: string }

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST'],
}))

app.use('/api/*', async (c, next) => {
  const secret = c.env.API_SECRET
  if (secret && c.req.header('x-api-secret') !== secret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// --- ルームごとの状態 ---
type RoomState = {
  currentSpeaker: string
  speakerCps: number
  lastSpeakerTime: number
  clickTimestamps: number[]
  speakingTime: Map<string, number>
  lastSpeedUpdate: Map<string, number>
  lastAccessTime: number
}

const rooms = new Map<string, RoomState>()
const EXPIRE_TIME = 5000
const ROOM_TTL = 1000 * 60 * 30 // 30分間アクセスがないルームを削除

function getRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      currentSpeaker: '誰も話していません',
      speakerCps: 0,
      lastSpeakerTime: 0,
      clickTimestamps: [],
      speakingTime: new Map(),
      lastSpeedUpdate: new Map(),
      lastAccessTime: Date.now(),
    })
  }
  const room = rooms.get(roomId)!
  room.lastAccessTime = Date.now()
  return room
}

function cleanupRooms() {
  const now = Date.now()
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastAccessTime > ROOM_TTL) rooms.delete(id)
  }
}

function getActiveWaitCount(room: RoomState): number {
  const now = Date.now()
  room.clickTimestamps = room.clickTimestamps.filter(t => now - t < EXPIRE_TIME)
  return room.clickTimestamps.length
}

function getSpeakingShares(room: RoomState): Record<string, number> {
  const total = Array.from(room.speakingTime.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return {}
  return Object.fromEntries(
    Array.from(room.speakingTime.entries())
      .map(([k, v]) => [k, Math.round(v / total * 100)])
      .sort((a, b) => (b[1] as number) - (a[1] as number))
  )
}

app.get('/api/room-status', (c) => {
  const roomId = c.req.query('roomId')
  if (!roomId) return c.json({ error: 'roomId is required' }, 400)

  cleanupRooms()
  const room = getRoom(roomId)
  const now = Date.now()

  if (now - room.lastSpeakerTime > 3000) {
    room.currentSpeaker = '誰も話していません'
    room.speakerCps = 0
  }

  const silenceDuration = room.lastSpeakerTime > 0 ? Math.floor((now - room.lastSpeakerTime) / 1000) : null
  const waitCount = getActiveWaitCount(room)

  return c.json({
    waitCount,
    currentSpeaker: room.currentSpeaker,
    speakerCps: room.speakerCps,
    speedLevel: room.speakerCps === 0 ? 'stop' : room.speakerCps > 7 ? 'fast' : 'normal',
    status: waitCount > 3 ? '🚨限界' : waitCount > 0 ? '✋少し待って' : '👍快適',
    speakingShares: getSpeakingShares(room),
    silenceDuration,
  })
})

app.post('/api/speed', async (c) => {
  const body = await c.req.json<{ userName: string, cps: number, roomId: string }>()
  if (!body.roomId) return c.json({ error: 'roomId is required' }, 400)

  const room = getRoom(body.roomId)
  const now = Date.now()

  if (body.cps > 0) {
    room.currentSpeaker = body.userName
    room.speakerCps = body.cps
    room.lastSpeakerTime = now

    const last = room.lastSpeedUpdate.get(body.userName)
    if (last) {
      const delta = Math.min(now - last, 2000)
      room.speakingTime.set(body.userName, (room.speakingTime.get(body.userName) ?? 0) + delta)
    }
    room.lastSpeedUpdate.set(body.userName, now)
  }

  return c.json({ success: true })
})

app.post('/api/wait', async (c) => {
  const body = await c.req.json<{ roomId: string }>()
  if (!body.roomId) return c.json({ error: 'roomId is required' }, 400)

  const room = getRoom(body.roomId)
  room.clickTimestamps.push(Date.now())
  return c.json({ success: true, currentCount: getActiveWaitCount(room) })
})

app.post('/api/reset', async (c) => {
  const body = await c.req.json<{ roomId?: string }>()
  if (body.roomId) {
    rooms.delete(body.roomId)
  } else {
    rooms.clear()
  }
  return c.json({ success: true })
})

export default app
