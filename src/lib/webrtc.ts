// WebRTC 연결 안정화 유틸리티
export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export const getMediaStream = async (video: boolean = true) => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video,
      audio: true,
    });
  } catch (error) {
    console.error("Media access error:", error);
    return null;
  }
};