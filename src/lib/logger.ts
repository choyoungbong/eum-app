// src/lib/logger.ts
// Winston 기반 구조화 로깅 시스템
// npm install winston winston-daily-rotate-file

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const LOG_DIR  = process.env.LOG_DIR  ?? "./logs";
const LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

// ── 커스텀 포맷 ──────────────────────────────────────────
const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : "";
    return `${timestamp} [${level}] ${message}${stack ? `\n${stack}` : ""}${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── 트랜스포트 ───────────────────────────────────────────
const transports: winston.transport[] = [];

// 콘솔 (개발 환경)
if (process.env.NODE_ENV !== "production") {
  transports.push(new winston.transports.Console({ format: prettyFormat }));
} else {
  transports.push(new winston.transports.Console({
    format: jsonFormat,
    level: "warn",
  }));
}

// 일별 로테이션 파일
transports.push(
  new DailyRotateFile({
    dirname:      path.join(LOG_DIR, "app"),
    filename:     "%DATE%.log",
    datePattern:  "YYYY-MM-DD",
    maxSize:      "20m",
    maxFiles:     "14d",  // 14일 보관
    format:       jsonFormat,
    level:        LOG_LEVEL,
  }),
  new DailyRotateFile({
    dirname:      path.join(LOG_DIR, "errors"),
    filename:     "%DATE%-error.log",
    datePattern:  "YYYY-MM-DD",
    maxSize:      "20m",
    maxFiles:     "30d",
    format:       jsonFormat,
    level:        "error",
  })
);

// ── 로거 생성 ────────────────────────────────────────────
const logger = winston.createLogger({
  level:      LOG_LEVEL,
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      dirname:     path.join(LOG_DIR, "exceptions"),
      filename:    "%DATE%-exception.log",
      datePattern: "YYYY-MM-DD",
      maxFiles:    "30d",
      format:      jsonFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      dirname:     path.join(LOG_DIR, "rejections"),
      filename:    "%DATE%-rejection.log",
      datePattern: "YYYY-MM-DD",
      maxFiles:    "30d",
      format:      jsonFormat,
    }),
  ],
});

export default logger;

// ── 컨텍스트 로거 (모듈별 prefix) ────────────────────────
export function createLogger(module: string) {
  return {
    debug: (msg: string, meta?: object) => logger.debug(msg, { module, ...meta }),
    info:  (msg: string, meta?: object) => logger.info(msg,  { module, ...meta }),
    warn:  (msg: string, meta?: object) => logger.warn(msg,  { module, ...meta }),
    error: (msg: string, meta?: object) => logger.error(msg, { module, ...meta }),
  };
}

// ── 사용 예시 ─────────────────────────────────────────────
// import { createLogger } from "@/lib/logger";
// const log = createLogger("FileUpload");
// log.info("파일 업로드 시작", { userId, filename, size });
// log.error("업로드 실패", { error: err.message, stack: err.stack });
