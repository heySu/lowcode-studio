/**
 * 运行时配置
 * ------------------------------------------------------------
 * 功能：集中管理端口、数据目录、静态资源目录、业务限制、CORS 白名单。
 * 业务：所有可调参数都能用环境变量覆盖，方便在不同环境（本地 / 测试 / 生产）部署，
 *      不允许把端口、路径这类部署相关的东西硬编码在业务代码里。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** server/ 目录 */
export const SERVER_ROOT = path.join(__dirname, '..')
/** 仓库根目录 */
export const PROJECT_ROOT = path.join(SERVER_ROOT, '..')

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  port: num(process.env.PORT, 3001),
  /** 默认监听所有网卡，便于容器/内网访问；本地可设 HOST=127.0.0.1 */
  host: process.env.HOST || '0.0.0.0',

  /** 数据持久化目录（pages.json 及其备份），生产可挂载独立磁盘 */
  dataDir: process.env.LC_DATA_DIR ? path.resolve(process.env.LC_DATA_DIR) : path.join(SERVER_ROOT, 'data'),

  /** 前端构建产物，存在时由本服务直接托管，实现单端口上线 */
  webDist: path.join(PROJECT_ROOT, 'web', 'dist'),

  /**
   * 业务限制：低代码平台最大的风险是「设计器生成畸形/超大 schema」，
   * 一旦落库，运行态渲染会拖垮浏览器甚至导致整页白屏。
   * 因此在写入前就做硬性约束，而不是等渲染时才发现。
   */
  limits: {
    maxNodes: num(process.env.LC_MAX_NODES, 800),
    maxDepth: 8,
    maxDatasources: 20,
    maxNameLength: 60,
    maxDescriptionLength: 500,
    /** 单个页面 schema 的 JSON 体积上限（1MB 已足够复杂页面） */
    maxSchemaBytes: 1024 * 1024,
    bodyLimit: '6mb'
  },

  /** 允许的前端来源；留空表示不限制（本地开发默认放开） */
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),

  /**
   * 允许用 iframe 嵌入本平台页面的父级来源（CSP frame-ancestors 的值）。
   * 业务：接入其它系统靠 iframe 嵌入时，浏览器的 X-Frame-Options: SAMEORIGIN 会直接拒绝跨域引用，
   *      所以带 ?embed=1 的页面改用 CSP 声明可被谁嵌入。
   *      '*' 是为了本地/内网开箱可用；生产务必收窄成自己的域名，
   *      例如 EMBED_ANCESTORS="https://portal.example.com https://admin.example.com"。
   */
  embedAncestors: process.env.EMBED_ANCESTORS || '*',

  /** 请求日志采样/等级由 LC_LOG_LEVEL 控制：debug | info | warn | error */
  logLevel: process.env.LC_LOG_LEVEL || 'info',

  isProd: process.env.NODE_ENV === 'production'
}
