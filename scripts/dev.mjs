/**
 * 本地一键启动
 * ------------------------------------------------------------
 * 功能：并行拉起后端（3001）与前端（5173），统一收口输出。
 * 业务：之前直接 spawn 的问题很典型——端口被占用时后端抛 EADDRINUSE 直接崩，
 *      脚本又连带把前端杀掉，用户看到的就是「页面打不开」。
 *      所以这里启动前先探测端口，冲突时给出可执行的解决方式；
 *      子进程异常退出时也不再连坐兄弟进程，方便定位问题。
 */
import net from 'node:net'
import { spawn } from 'node:child_process'

const PORTS = [
  { port: 3001, name: '后端 API' },
  { port: 5173, name: '前端 Vite' }
]

const reset = '\x1b[0m'
const colorOf = { server: '\x1b[36m', web: '\x1b[32m' }

/** 探测端口是否已被监听 */
function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    const finish = (busy) => {
      socket.destroy()
      resolve(busy)
    }
    socket.setTimeout(600)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

const busy = []
for (const item of PORTS) {
  if (await isPortBusy(item.port)) busy.push(item)
}

if (busy.length) {
  console.error('\n启动前检查未通过：\n')
  busy.forEach((item) => {
    console.error(`  ✗ ${item.name} 端口 ${item.port} 已被占用`)
  })
  console.error(`
  可能已经运行了一份服务。可以：
    1. 直接访问 http://localhost:${busy.some((b) => b.port === 3001) ? 3001 : 5173} 看看是否就是它；
    2. 停掉占用进程： npx kill-port ${busy.map((b) => b.port).join(' ')}；
    3. 换端口启动：   PORT=3002 npm run dev:server
`)
  process.exit(1)
}

console.log('正在启动：后端 http://localhost:3001 ，前端 http://localhost:5173\n')

const tasks = [
  { name: 'server', cwd: 'server', args: ['run', 'dev'] },
  { name: 'web', cwd: 'web', args: ['run', 'dev'] }
]

const children = []

function run(task) {
  const child = spawn('npm', task.args, { cwd: task.cwd, shell: true })
  children.push(child)
  const prefix = `${colorOf[task.name]}[${task.name}]${reset} `

  const pipe = (stream, sink) => {
    let buffer = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      lines.forEach((line) => line && sink.write(prefix + line + '\n'))
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)

  child.on('exit', (code) => {
    if (code === 0 || code === null) {
      process.stdout.write(`${prefix}进程已结束\n`)
    } else {
      process.stdout.write(`${prefix}异常退出（code ${code}），其他进程继续运行，请查看上方日志\n`)
    }
    // 全部结束后再退出，避免一个失败就让另一个服务无声消失
    if (children.every((c) => c.exitCode !== null)) process.exit(0)
  })
}

function shutdown() {
  children.forEach((child) => child.exitCode === null && child.kill())
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

tasks.forEach(run)
