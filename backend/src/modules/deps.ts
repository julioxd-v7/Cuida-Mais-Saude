import type { AppConfig } from '../config.ts';
import type { Db } from '../db/types.ts';
import type { Mailer } from '../mail/mailer.ts';
import type { RateLimiter } from '../security/rateLimit.ts';
import type { FileStorage } from '../storage/fileStorage.ts';
import type { GoogleVerifier } from '../security/google.ts';

export type Deps = {
  db: Db;
  config: AppConfig;
  mailer: Mailer;
  storage: FileStorage;
  google: GoogleVerifier;
  limits: {
    login: RateLimiter;
    register: RateLimiter;
    forgot: RateLimiter;
    reset: RateLimiter;
    messages: RateLimiter;
    account: RateLimiter;
  };
  log: (message: string) => void;
};
