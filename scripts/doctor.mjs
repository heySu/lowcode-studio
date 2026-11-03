/**
 * 环境自检
 * ------------------------------------------------------------
 * 功能：一条命令排查「页面打不开」的常见原因。
 * 业务：交付给同事/客户时，先跑 npm run doctor，比来回截图问「你那边什么情况」高效得多。
 *      检查项覆盖：Node 版本、依赖是否安装、构建产物、端口占用、后端健康、数据文件可读。
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const results = []
const pass = (msg, hint = '') => results.push({ ok: true, msg, hint })
const fail = (msg, hint = '') => results.push({ ok: false, msg, hint })

// 1. Node 版本
const major = Number(process.version.replace('v', '').split('.')[0])
major >= 18 ? pass(`Node 版本 ${process.version}`) : fail(`Node 版本过低 ${process.version}`, '需要 Node 18+，建议 20/22 LTS')

// 2. 依赖
for (const dir of ['server', 'web']) {
  const exists = fs.existsSync(path.join(ROOT, dir, 'node_modules'))
  exists ? pass(`${dir} 依赖已安装`) : fail(`${dir} 依赖缺失`, `在项目根目录执行： npm install --prefix ${dir}`)
}

// 3. 构建产物（仅提示，不影响开发模式）
const dist = path.join(ROOT, 'web', 'dist', 'index.html')
fs.existsSync(dist) ? pass('前端已构建（可由 3001 单端口托管）') : fail('前端未构建', '仅在单端口部署时需要： npm run build')

// 4. 数据目录可写
try {
  const dir = path.join(ROOT, 'server', 'data')
  fs.mkdirSync(dir, { recursive: true })
  fs.accessSync(dir, fs.constants.W_OK)
  const file = path.join(dir, 'pages.json')
  pass(`数据目录可写（${fs.existsSync(file) ? '已存在 pages.json' : '等待首次初始化'}）`)
} catch (err) {
  fail('数据目录不可写', err.message)
}

// 5. 端口
const checkPort = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.setTimeout(600)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })

const apiUp = await checkPort(3001)
apiUp ? pass('后端 3001 端口已监听') : fail('后端 3001 未运行', '执行 npm run dev 或 npm start')
const webUp = await checkPort(5173)
webUp ? pass('前端 5173 端口已监听（开发模式）') : pass('前端 5173 未运行（开发模式未启动，或用 3001 单端口访问）')

// 6. 后端健康
if (apiUp) {
  try {
    const res = await fetch('http://localhost:3001/api/health')
    const json = await res.json()
    json.success
      ? pass(`后端健康检查通过（页面 ${json.data.pages} 个，运行 ${json.data.uptime}s）`)
      : fail('后端健康检查返回异常', JSON.stringify(json))
  } catch (err) {
    fail('后端健康检查失败', err.message)
  }
}

console.log('\nLowCode Studio 环境自检\n' + '─'.repeat(52))
results.forEach((item) => {
  console.log(`  ${item.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${item.msg}`)
  if (item.hint) console.log(`      → ${item.hint}`)
})
const failed = results.filter((item) => !item.ok).length
console.log('─'.repeat(52))
console.log(failed ? `存在 ${failed} 项待处理\n` : '全部通过，可直接 npm run dev 启动\n')
process.exit(failed ? 1 : 0)
