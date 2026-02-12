// WebRTC 유틸리티
export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  
  // STUN/TURN 서버 설정
  private configuration: RTCConfiguration = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
      // TURN 서버 (선택사항 - 방화벽 우회용)
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: 'username',
      //   credential: 'password',
      // },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor() {}

  /**
   * 로컬 미디어 스트림 시작 (카메라/마이크)
   */
  async startLocalStream(constraints: MediaStreamConstraints = { audio: true, video: false }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('로컬 스트림 시작 실패:', error);
      throw error;
    }
  }

  /**
   * Peer Connection 생성
   */
  createPeerConnection(
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onTrack: (stream: MediaStream) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  ) {
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // ICE Candidate 이벤트
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE Candidate:', event.candidate);
        onIceCandidate(event.candidate);
      }
    };

    // Track 수신 이벤트 (상대방 스트림)
    this.peerConnection.ontrack = (event) => {
      console.log('📡 Track received:', event.streams[0]);
      this.remoteStream = event.streams[0];
      onTrack(event.streams[0]);
    };

    // 연결 상태 변경
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Connection state:', state);
      if (onConnectionStateChange && state) {
        onConnectionStateChange(state);
      }
    };

    // ICE 연결 상태 변경
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('❄️ ICE connection state:', this.peerConnection?.iceConnectionState);
    };

    // 로컬 스트림을 Peer Connection에 추가
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    return this.peerConnection;
  }

  /**
   * Offer 생성 (발신자)
   */
  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('📤 Offer created:', offer);
      
      return offer;
    } catch (error) {
      console.error('Offer 생성 실패:', error);
      throw error;
    }
  }

  /**
   * Answer 생성 (수신자)
   */
  async createAnswer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('📥 Answer created:', answer);
      return answer;
    } catch (error) {
      console.error('Answer 생성 실패:', error);
      throw error;
    }
  }

  /**
   * Answer 적용 (발신자)
   */
  async setRemoteAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote answer set');
    } catch (error) {
      console.error('Answer 적용 실패:', error);
      throw error;
    }
  }

  /**
   * ICE Candidate 추가
   */
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error) {
      console.error('ICE candidate 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 통화 종료
   */
  close() {
    // 로컬 스트림 중지
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Peer Connection 종료
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('📴 통화 종료');
  }

  /**
   * 음소거/음소거 해제
   */
  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // true = 음소거됨
      }
    }
    return false;
  }

  /**
   * 비디오 켜기/끄기
   */
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled; // true = 비디오 켜짐
      }
    }
    return false;
  }

  /**
   * Getters
   */
  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  getPeerConnection() {
    return this.peerConnection;
  }
}

/**
 * 네트워크 타입 감지
 */
export function detectNetworkType(): 'WIFI' | 'CELLULAR' | 'OFFLINE' {
  if (!navigator.onLine) {
    return 'OFFLINE';
  }

  // Network Information API (실험적 기능)
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    const type = connection.effectiveType;
    
    // 4g, 3g, 2g = CELLULAR
    if (['4g', '3g', '2g', 'slow-2g'].includes(type)) {
      return 'CELLULAR';
    }
  }

  // 기본값: WIFI
  return 'WIFI';
}

/**
 * 통화 가능 여부 확인
 */
export function canMakeCall(networkType: 'WIFI' | 'CELLULAR' | 'OFFLINE'): boolean {
  // 오프라인이면 통화 불가
  if (networkType === 'OFFLINE') {
    return false;
  }

  // Wi-Fi 또는 데이터 연결이면 통화 가능
  return true;
}

/**
 * 미디어 권한 확인
 */
export async function checkMediaPermissions(audio: boolean = true, video: boolean = false) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('미디어 권한 없음:', error);
    return false;
  }
}