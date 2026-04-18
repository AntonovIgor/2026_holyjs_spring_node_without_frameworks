import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { TooManyRequestsException } from '../../exception/HttpException.js';

/** Настройки rate limiter. */
export interface RateLimitOptions {
  /** Максимальный запас токенов (максимальный burst). */
  maxTokens: number;
  /** Скорость пополнения токенов в секунду. */
  refillRate: number;
  /** Функция для извлечения ключа клиента из запроса. По умолчанию — IP. */
  keyFn?: (req: Request) => string;
  /** Миллисекунд без активности после которых bucket вытесняется. По умолчанию 60 000. */
  bucketTtlMs?: number;
  /** Максимальное число bucket-ов. Старейший по последнему обращению вытесняется первым. По умолчанию 10 000. */
  maxBuckets?: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate limiter на алгоритме «токенное ведро» (token bucket).
 *
 * Каждый клиент (по IP или кастомному ключу) имеет собственное ведро с токенами.
 * Токены расходуются на каждый запрос и пополняются со временем.
 * При нулевом балансе — 429 Too Many Requests с заголовком Retry-After.
 * Bucket-ы хранятся в памяти с LRU-вытеснением по TTL и максимальному числу.
 */
export class RateLimitMiddleware implements Middleware {
  readonly name = 'RateLimitMiddleware';

  private readonly buckets = new Map<string, Bucket>();
  private readonly bucketTtlMs: number;
  private readonly maxBuckets: number;

  constructor(private readonly options: RateLimitOptions) {
    this.bucketTtlMs = options.bucketTtlMs ?? 60_000;
    this.maxBuckets = options.maxBuckets ?? 10_000;
  }

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    const key = this.options.keyFn?.(req)
      ?? (req.headers['x-forwarded-for'] as string | undefined)
      ?? req.raw.socket.remoteAddress
      ?? 'unknown';

    const now = Date.now();
    this.evict(now);

    let bucket = this.buckets.get(key);

    if (!bucket) {
      if (this.buckets.size >= this.maxBuckets) {
        // вытесняем первый (наиболее старый по insertion order)
        this.buckets.delete(this.buckets.keys().next().value!);
      }
      bucket = { tokens: this.options.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      // переставляем в конец Map, чтобы LRU-порядок был актуальным
      this.buckets.delete(key);
      this.buckets.set(key, bucket);
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.options.maxTokens, bucket.tokens + elapsed * this.options.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / this.options.refillRate);
      res.header('Retry-After', String(retryAfter));
      throw new TooManyRequestsException();
    }

    bucket.tokens -= 1;
    await next();
  }

  private evict(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > this.bucketTtlMs) {
        this.buckets.delete(key);
      } else {
        break;
      }
    }
  }
}
