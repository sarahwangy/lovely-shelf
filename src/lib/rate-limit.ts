// 模块级 Map，在同一个 serverless 实例生命周期内持久存在
// key = "userId:action"，value = { count, resetAt }
const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * 检查某个用户的某个操作是否超出频率限制
 * @param userId  用户标识（邮箱）
 * @param action  操作名称（如 "upload", "chat"）
 * @param limit   每个周期最多允许的次数
 * @param windowMs 时间窗口（毫秒），默认 24 小时
 */
export function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs = 24 * 60 * 60 * 1000
): RateLimitResult {
  const key = `${userId}:${action}`;
  const now = Date.now();

  const entry = store.get(key);

  // 没有记录，或者窗口已过期 → 重置
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  // 已超出限制
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // 正常计数
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
