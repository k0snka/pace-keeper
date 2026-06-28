import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST'],
}))

let currentSpeaker = '誰も話していません'
let speakerCps = 0
let lastSpeakerTime = 0

let clickTimestamps: number[] = []
const EXPIRE_TIME = 5000

function getActiveWaitCount(): number {
  const now = Date.now()
  clickTimestamps = clickTimestamps.filter(timestamp => now - timestamp < EXPIRE_TIME)
  return clickTimestamps.length
}

app.get('/api/room-status', (c) => {
  const now = Date.now()

  // 3秒無発言なら話し終わったとみなしてリセット
  if (now - lastSpeakerTime > 3000) {
    currentSpeaker = '誰も話していません'
    speakerCps = 0
  }

  const currentWaitCount = getActiveWaitCount()

  return c.json({
    waitCount: currentWaitCount,
    currentSpeaker,
    speakerCps,
    speedLevel: speakerCps === 0 ? 'stop' : speakerCps > 5 ? 'fast' : 'normal',
    status: currentWaitCount > 3 ? '🚨限界' : currentWaitCount > 0 ? '🐢少し待って' : '🐰快適'
  })
})

app.post('/api/speed', async (c) => {
  const body = await c.req.json<{ userName: string, cps: number }>()

  if (body.cps > 0) {
    currentSpeaker = body.userName
    speakerCps = body.cps
    lastSpeakerTime = Date.now()
  }

  return c.json({ success: true })
})

app.post('/api/wait', (c) => {
  clickTimestamps.push(Date.now())

  const currentCount = getActiveWaitCount()
  return c.json({ success: true, currentCount })
})

// デバッグ用
app.post('/api/reset', (c) => {
  clickTimestamps = []
  currentSpeaker = '誰も話していません'
  speakerCps = 0
  return c.json({ success: true })
})

export default app
