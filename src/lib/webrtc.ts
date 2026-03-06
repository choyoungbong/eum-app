// src/lib/webrtc.ts

// ✅ 기존 export 유지 (ICE_SERVERS, getMediaStream) — 다른 파일에서 import 중이면 그대로 동작
export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

// ✅ 기존 getMediaStream 유지 + 내부 개선 (audio 제약조건 추가)
export const getMediaStream = async (video: boolean = true): Promise<MediaStream | null> => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      // ✅ 수정: audio 제약조건 명시 — echo/noise 캔슬링, mono 채널로 안정성 확보
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
    });
  } catch (error) {
    console.error("Media access error:", error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// WebRTCManager 클래스
// 한쪽 음성 안들림 버그 수정 포인트:
//   1. ontrack에서 audio track을 전용 <audio> element에 직접 attach
//   2. srcObject 매번 재할당으로 연결 누락 방지
//   3. play() promise 처리로 autoplay 차단 대응
//   4. audio track을 video보다 먼저 addTrack (SDP 협상 우선순위)
// ─────────────────────────────────────────────────────────────
export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;
  private config: WebRTCConfig;

  constructor(config: WebRTCConfig = {}) {
    this.config = config;
  }

  // ─── PeerConnection 초기화 ──────────────────────────────
  createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      this.pc.close();
    }

    this.pc = new RTCPeerConnection(
      this.config.iceServers
        ? { iceServers: this.config.iceServers }
        : ICE_SERVERS  // ✅ 기존 ICE_SERVERS 재사용
    );

    // ✅ 핵심 수정 1: ontrack에서 audio/video 구분 처리
    this.pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      // ✅ 핵심 수정 2: stream 교체 시마다 콜백 + audio element 재설정
      if (this.remoteStream?.id !== remoteStream.id) {
        this.remoteStream = remoteStream;
        this.config.onRemoteStream?.(remoteStream);
      }

      // ✅ 핵심 수정 3: audio track은 전용 element에 직접 attach
      if (event.track.kind === "audio") {
        this.attachRemoteAudio(remoteStream);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onIceCandidate?.(event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state) this.config.onConnectionStateChange?.(state);
    };

    return this.pc;
  }

  // ✅ 핵심 수정 4: 전용 <audio> element 생성 및 srcObject 재할당
  private attachRemoteAudio(stream: MediaStream) {
    try {
      if (!this.remoteAudioEl) {
        this.remoteAudioEl = document.createElement("audio");
        this.remoteAudioEl.autoplay = true;
        // ✅ 수정: playsInline은 HTMLVideoElement 전용 — HTMLAudioElement에 없음
        this.remoteAudioEl.style.display = "none";
        document.body.appendChild(this.remoteAudioEl);
      }

      // 동일 stream이라도 srcObject 재할당 (연결 누락 방지)
      this.remoteAudioEl.srcObject = stream;

      // ✅ 핵심 수정 5: play() promise 처리 — autoplay 차단 시 재시도
      const playPromise = this.remoteAudioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // 사용자 인터랙션 이후 한 번만 재시도
          const retry = () => {
            this.remoteAudioEl?.play().catch(console.error);
            document.removeEventListener("click", retry);
          };
          document.addEventListener("click", retry, { once: true });
        });
      }
    } catch (err) {
      console.error("[WebRTC] attachRemoteAudio error:", err);
    }
  }

  // ─── 로컬 스트림 설정 ───────────────────────────────────
  async getLocalStream(video = true, audio = true): Promise<MediaStream> {
    const stream = await getMediaStream(video);
    if (!stream) throw new Error("미디어 장치에 접근할 수 없습니다");
    // audio 파라미터가 false면 audio track 비활성화
    if (!audio) stream.getAudioTracks().forEach((t) => (t.enabled = false));
    this.localStream = stream;
    return stream;
  }

  // ─── 로컬 트랙 추가 ─────────────────────────────────────
  addLocalTracks(stream?: MediaStream) {
    const src = stream ?? this.localStream;
    if (!src || !this.pc) return;

    // ✅ 핵심 수정 6: audio 먼저 추가 (SDP 협상 우선순위 확보)
    src.getAudioTracks().forEach((track) => {
      this.pc!.addTrack(track, src);
    });
    src.getVideoTracks().forEach((track) => {
      this.pc!.addTrack(track, src);
    });
  }

  // ─── Offer / Answer ─────────────────────────────────────
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("PeerConnection이 초기화되지 않았습니다");
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("PeerConnection이 초기화되지 않았습니다");
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) throw new Error("PeerConnection이 초기화되지 않았습니다");
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) throw new Error("PeerConnection이 초기화되지 않았습니다");
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // 연결 종료 후 들어오는 candidate는 무시
    }
  }

  // ─── 음소거 / 카메라 토글 ───────────────────────────────
  toggleMute(mute: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !mute));
  }

  toggleVideo(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  // ─── 정리 ───────────────────────────────────────────────
  destroy() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    if (this.remoteAudioEl) {
      this.remoteAudioEl.srcObject = null;
      this.remoteAudioEl.remove();
      this.remoteAudioEl = null;
    }

    this.pc?.close();
    this.pc = null;
    this.remoteStream = null;
  }

  // ─── Getters ────────────────────────────────────────────
  get peerConnection() { return this.pc; }
  get local()          { return this.localStream; }
  get remote()         { return this.remoteStream; }
}

// ─── 싱글톤 헬퍼 (채팅 페이지에서 편하게 사용) ──────────────
let _instance: WebRTCManager | null = null;

export function getWebRTCManager(config?: WebRTCConfig): WebRTCManager {
  if (!_instance) _instance = new WebRTCManager(config);
  return _instance;
}

export function destroyWebRTCManager() {
  _instance?.destroy();
  _instance = null;
}