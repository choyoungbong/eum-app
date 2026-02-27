// src/lib/notification-prefs.ts
// NotificationPreferences 타입과 기본값을 route 파일 밖으로 분리
// route.ts에서 export const/interface를 사용하면 Next.js 빌드 오류 발생

export interface NotificationPreferences {
  pushEnabled: boolean;
  comment:     boolean;
  share:       boolean;
  chat:        boolean;
  call:        boolean;
  system:      boolean;
  fileUpload:  boolean;
  emailDigest: boolean;
}

export const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  comment:     true,
  share:       true,
  chat:        true,
  call:        true,
  system:      true,
  fileUpload:  false,
  emailDigest: false,
};
