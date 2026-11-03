/**
 * 日志
 * ------------------------------------------------------------
 * 功能：带时间戳与等级的统一日志输出，替代散落的 console.log。
 * 业务：上线后排查问题基本靠日志，因此每次请求都会记录「方法、路径、状态码、耗时」，
 *      并带上 requestId，前端报错时可以把 requestId 报给运维直接定位。
 */
import { config } from './config.js'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const threshold = LEVELS[config.logLevel] ?? LEVELS.info

function write(level, message, meta) {
  if (LEVELS[level] < threshold) return
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`
  const sink = level === 'error' || level === 'warn' ? console.error : console.log
  if (meta === undefined) sink(line)
  else sink(line, typeof meta === 'object' ? JSON.stringify(meta) : meta)
}

export const logger = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta)
}
