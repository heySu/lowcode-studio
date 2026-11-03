/**
 * 统一错误类型
 * ------------------------------------------------------------
 * 功能：区分「用户输入错误（4xx，可把原文案返回给前端）」与「系统异常（5xx，对外脱敏）」。
 * 业务：低代码平台的报错要能直接指导操作（例如「页面已在其他窗口被修改」），
 *      但数据库/文件系统异常不能把堆栈暴露给使用者。
 */
export class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    /** 允许把文案直接返回给前端 */
    this.expose = status < 500
  }
}

/** 参数/结构校验失败 */
export const invalid = (message, code = 'VALIDATION_FAILED') => new AppError(message, 422, code)

/** 资源不存在 */
export const notFound = (message = '资源不存在', code = 'NOT_FOUND') => new AppError(message, 404, code)

/** 并发编辑冲突（乐观锁） */
export const conflict = (message, code = 'REVISION_CONFLICT') => new AppError(message, 409, code)
