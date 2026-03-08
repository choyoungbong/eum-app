// src/lib/webrtc.ts

export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },

    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export const getMediaStream = async (
  video: boolean = true
): Promise<MediaStream | null> => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: video
        ? { width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (error) {
    console.error("Media access error:", error);
    return null;
  }
};

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

  private config: WebRTCConfig;

  private pendingCandidates: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;

  constructor(config: WebRTCConfig = {}) {
    this.config = config;
  }

  createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      this.pc.close();
    }

    this.pendingCandidates = [];
    this.hasRemoteDescription = false;

    this.pc = new RTCPeerConnection(
      this.config.iceServers
        ? { iceServers: this.config.iceServers }
        : ICE_SERVERS
    );

    this.remoteStream = new MediaStream();

    this.pc.ontrack = (event) => {
      console.log("Remote track:", event.track.kind);

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      this.remoteStream.addTrack(event.track);

      this.config.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onIceCandidate?.(event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state) {
        console.log("WebRTC state:", state);
        this.config.onConnectionStateChange?.(state);
      }
    };

    return this.pc;
  }

  async getLocalStream(video = true): Promise<MediaStream> {
    const stream = await getMediaStream(video);
    if (!stream) throw new Error("미디어 장치 접근 실패");

    this.localStream = stream;
    return stream;
  }

  addLocalTracks(stream?: MediaStream) {
    const src = stream ?? this.localStream;

    if (!src || !this.pc) return;

    src.getTracks().forEach((track) => {
      this.pc!.addTrack(track, src);
    });
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("PeerConnection 없음");

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.pc.setLocalDescription(offer);

    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("PeerConnection 없음");

    const answer = await this.pc.createAnswer();

    await this.pc.setLocalDescription(answer);

    return answer;
  }

  async setRemoteDescription(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) throw new Error("PeerConnection 없음");

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));

    this.hasRemoteDescription = true;

    if (this.pendingCandidates.length > 0) {
      for (const candidate of this.pendingCandidates) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }

      this.pendingCandidates = [];
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;

    if (!this.hasRemoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }

  toggleMute(mute: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !mute;
    });
  }

  toggleVideo(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  destroy() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    this.pc?.close();
    this.pc = null;

    this.remoteStream = null;

    this.pendingCandidates = [];
    this.hasRemoteDescription = false;
  }

  get peerConnection() {
    return this.pc;
  }

  get local() {
    return this.localStream;
  }

  get remote() {
    return this.remoteStream;
  }
}

let _instance: WebRTCManager | null = null;

export function getWebRTCManager(config?: WebRTCConfig): WebRTCManager {
  if (!_instance) {
    _instance = new WebRTCManager(config);
  }
  return _instance;
}

export function destroyWebRTCManager() {
  _instance?.destroy();
  _instance = null;
}