// ecosystem.config.js
// PM2 프로세스 관리 설정
// 사용: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name:        "eum",
      script:      "server.ts",
      interpreter: "node",
      interpreter_args: "--require tsx/cjs",

      // ── 클러스터 모드 ──────────────────────────────────
      instances:   "max",          // CPU 코어 수만큼 인스턴스
      exec_mode:   "cluster",

      // ── 환경변수 ──────────────────────────────────────
      env: {
        NODE_ENV: "development",
        PORT:     3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT:     3000,
      },

      // ── 로그 ──────────────────────────────────────────
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      out_file:        "./logs/pm2-out.log",
      error_file:      "./logs/pm2-error.log",
      merge_logs:      true,
      log_type:        "json",

      // ── 자동 재시작 ────────────────────────────────────
      watch:           false,      // 프로덕션에서는 false
      autorestart:     true,
      max_restarts:    10,
      min_uptime:      "10s",
      restart_delay:   3000,       // 3초 대기 후 재시작

      // ── 메모리 한도 초과 시 재시작 ────────────────────
      max_memory_restart: "1G",

      // ── 무중단 배포 ────────────────────────────────────
      kill_timeout:    5000,       // SIGKILL 전 대기 시간 (ms)
      wait_ready:      true,
      listen_timeout:  10000,

      // ── 헬스 모니터링 ──────────────────────────────────
      exp_backoff_restart_delay: 100,
    },
  ],

  // ── PM2 배포 설정 (pm2 deploy 명령용) ─────────────────
  deploy: {
    production: {
      user:        "deploy",
      host:        ["your-server-ip"],
      ref:         "origin/main",
      repo:        "git@github.com:your-username/eum.git",
      path:        "/opt/eum",
      "pre-deploy-local": "",
      "post-deploy":
        "npm ci && npx prisma migrate deploy && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "apt-get install -y git",
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
