// ===== 错误码定义 =====
// 格式：模块前缀(2位) + 错误序号(2位) = 4位数字

export const ErrorCodes = {
  // 认证错误 (10xx)
  AUTH_MISSING: { code: 'AUTH_MISSING', num: 1001, http: 401, message: '缺少 Authorization Header', retryable: false },
  AUTH_INVALID_FORMAT: { code: 'AUTH_INVALID_FORMAT', num: 1002, http: 401, message: 'Token 格式错误，期望 Bearer 格式', retryable: false },
  AUTH_INVALID_TOKEN: { code: 'AUTH_INVALID_TOKEN', num: 1003, http: 401, message: 'Token 无效或不匹配', retryable: false },
  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_INVALID_CREDENTIALS', num: 1004, http: 401, message: '用户名或密码错误', retryable: false },

  // 参数验证错误 (20xx)
  VALIDATION_INVALID_DATE: { code: 'VALIDATION_INVALID_DATE', num: 2001, http: 400, message: 'date 参数格式错误，期望 YYYY-MM-DD', retryable: false },
  VALIDATION_INVALID_SOURCE: { code: 'VALIDATION_INVALID_SOURCE', num: 2002, http: 400, message: 'source 参数值无效，期望 openai/anthropic', retryable: false },
  VALIDATION_INVALID_PAGE: { code: 'VALIDATION_INVALID_PAGE', num: 2003, http: 400, message: 'page 参数必须是正整数', retryable: false },
  VALIDATION_INVALID_PAGE_SIZE: { code: 'VALIDATION_INVALID_PAGE_SIZE', num: 2004, http: 400, message: 'page_size 必须在 1-50 之间', retryable: false },
  VALIDATION_INVALID_DAYS: { code: 'VALIDATION_INVALID_DAYS', num: 2005, http: 400, message: 'days 必须在 1-7 之间', retryable: false },
  VALIDATION_INVALID_JSON: { code: 'VALIDATION_INVALID_JSON', num: 2006, http: 400, message: '请求体必须是合法 JSON', retryable: false },

  // 限流错误 (30xx)
  RATE_LIMITED: { code: 'RATE_LIMITED', num: 3001, http: 429, message: '超过全局限流阈值', retryable: true },

  // 数据源错误 (40xx) - 这些在刷新流程中处理，不直接返回给客户端
  SOURCE_FETCH_FAILED: { code: 'SOURCE_FETCH_FAILED', num: 4001, http: 0, message: '页面请求失败（网络错误）', retryable: true },
  SOURCE_HTTP_ERROR: { code: 'SOURCE_HTTP_ERROR', num: 4002, http: 0, message: '页面返回非 2xx 状态码', retryable: true },
  SOURCE_TIMEOUT: { code: 'SOURCE_TIMEOUT', num: 4003, http: 0, message: '页面请求超时', retryable: true },
  SOURCE_PARSE_FAILED: { code: 'SOURCE_PARSE_FAILED', num: 4004, http: 0, message: 'HTML 解析失败，未找到预期结构', retryable: false },
  SOURCE_EMPTY_ARTICLES: { code: 'SOURCE_EMPTY_ARTICLES', num: 4005, http: 0, message: '解析成功但未找到任何文章', retryable: true },
  SOURCE_ARTICLE_INCOMPLETE: { code: 'SOURCE_ARTICLE_INCOMPLETE', num: 4006, http: 0, message: '文章缺少必要元数据（标题/链接/时间）', retryable: false },
  SOURCE_CONTENT_FETCH_FAILED: { code: 'SOURCE_CONTENT_FETCH_FAILED', num: 4007, http: 0, message: '获取文章正文失败', retryable: true },

  // LLM 错误 (50xx)
  LLM_REQUEST_FAILED: { code: 'LLM_REQUEST_FAILED', num: 5001, http: 0, message: 'LLM API 请求失败（网络错误）', retryable: true },
  LLM_TIMEOUT: { code: 'LLM_TIMEOUT', num: 5002, http: 0, message: 'LLM API 超时', retryable: true },
  LLM_RATE_LIMITED: { code: 'LLM_RATE_LIMITED', num: 5003, http: 0, message: 'LLM API 限流', retryable: true },
  LLM_QUOTA_EXCEEDED: { code: 'LLM_QUOTA_EXCEEDED', num: 5004, http: 0, message: 'LLM 配额耗尽', retryable: true },
  LLM_INVALID_RESPONSE: { code: 'LLM_INVALID_RESPONSE', num: 5005, http: 0, message: 'LLM 返回内容格式不符合预期', retryable: true },
  LLM_EMPTY_RESPONSE: { code: 'LLM_EMPTY_RESPONSE', num: 5006, http: 0, message: 'LLM 返回空内容', retryable: true },
  LLM_AUTH_FAILED: { code: 'LLM_AUTH_FAILED', num: 5007, http: 0, message: 'LLM API Key 无效或过期', retryable: false },

  // 存储错误 (60xx)
  KV_READ_FAILED: { code: 'KV_READ_FAILED', num: 6001, http: 0, message: 'KV 读取操作失败', retryable: true },
  KV_WRITE_FAILED: { code: 'KV_WRITE_FAILED', num: 6002, http: 0, message: 'KV 写入操作失败', retryable: true },
  KV_TIMEOUT: { code: 'KV_TIMEOUT', num: 6003, http: 0, message: 'KV 操作超时', retryable: true },
  KV_DELETE_FAILED: { code: 'KV_DELETE_FAILED', num: 6004, http: 0, message: 'KV 删除操作失败', retryable: true },

  // 系统错误 (90xx)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', num: 9001, http: 500, message: '未预期的内部错误', retryable: true },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', num: 9002, http: 503, message: '服务暂时不可用', retryable: true },
  CONFIG_MISSING: { code: 'CONFIG_MISSING', num: 9003, http: 500, message: '必需的配置/环境变量缺失', retryable: false },
  CONFIG_INVALID: { code: 'CONFIG_INVALID', num: 9004, http: 500, message: '配置格式错误', retryable: false },
} as const;

export type ErrorCodeKey = keyof typeof ErrorCodes;
export type ErrorCodeInfo = typeof ErrorCodes[ErrorCodeKey];

export class AppError extends Error {
  public readonly code: string;
  public readonly codeNum: number;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(errorKey: ErrorCodeKey, originalError?: Error) {
    const errorInfo = ErrorCodes[errorKey];
    super(errorInfo.message);

    this.name = 'AppError';
    this.code = errorInfo.code;
    this.codeNum = errorInfo.num;
    this.httpStatus = errorInfo.http;
    this.retryable = errorInfo.retryable;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        code_num: this.codeNum,
        message: this.message,
        retryable: this.retryable,
      },
    };
  }
}

// 辅助函数：根据错误码前缀判断错误类型
export function isAuthError(error: AppError): boolean {
  return error.codeNum >= 1000 && error.codeNum < 2000;
}

export function isValidationError(error: AppError): boolean {
  return error.codeNum >= 2000 && error.codeNum < 3000;
}

export function isRateLimitError(error: AppError): boolean {
  return error.codeNum >= 3000 && error.codeNum < 4000;
}

export function isSourceError(error: AppError): boolean {
  return error.codeNum >= 4000 && error.codeNum < 5000;
}

export function isLLMError(error: AppError): boolean {
  return error.codeNum >= 5000 && error.codeNum < 6000;
}

export function isKVError(error: AppError): boolean {
  return error.codeNum >= 6000 && error.codeNum < 7000;
}
