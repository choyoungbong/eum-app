// src/lib/sound.ts
// Web Audio API 기반 알림 사운드 — 외부 파일 불필요
// 브라우저 내에서 직접 소리 합성

type SoundType = "message" | "notification" | "success" | "error" | "call";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3,
  delay = 0
): void {
  const ac  = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ac.currentTime + delay);

  gain.gain.setValueAtTime(0, ac.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);

  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.01);
}

const SOUNDS: Record<SoundType, () => void> = {
  // 채팅 메시지: 맑은 두 음
  message: () => {
    playTone(880, 0.08, "sine", 0.2);
    playTone(1200, 0.1, "sine", 0.15, 0.09);
  },
  // 알림: 부드러운 핑
  notification: () => {
    playTone(660, 0.15, "sine", 0.25);
    playTone(880, 0.12, "sine", 0.2, 0.1);
  },
  // 성공: 상승 3음
  success: () => {
    playTone(523, 0.1, "sine", 0.2);
    playTone(659, 0.1, "sine", 0.2, 0.1);
    playTone(784, 0.15, "sine", 0.2, 0.2);
  },
  // 에러: 낮은 두 음
  error: () => {
    playTone(220, 0.15, "sawtooth", 0.15);
    playTone(180, 0.2, "sawtooth", 0.12, 0.12);
  },
  // 통화 수신: 반복 링 (3회)
  call: () => {
    [0, 0.6, 1.2].forEach((delay) => {
      playTone(480, 0.3, "sine", 0.3, delay);
      playTone(380, 0.3, "sine", 0.25, delay + 0.02);
    });
  },
};

// ── 설정 ──────────────────────────────────────────────────
const PREF_KEY = "eum_sound_enabled";

export function isSoundEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== "false"; } catch { return true; }
}
export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? "true" : "false"); } catch {}
}

// ── 공개 API ─────────────────────────────────────────────
export function playSound(type: SoundType) {
  if (typeof window === "undefined") return;
  if (!isSoundEnabled()) return;
  try { SOUNDS[type]?.(); } catch {}
}

export const sound = {
  message:      () => playSound("message"),
  notification: () => playSound("notification"),
  success:      () => playSound("success"),
  error:        () => playSound("error"),
  call:         () => playSound("call"),
};
