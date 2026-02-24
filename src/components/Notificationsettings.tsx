"use client";

import { useState, useEffect } from "react";
import { registerFCMToken, unregisterFCMToken } from "@/lib/firebase";
import { toast } from "@/components/Toast";

export default function NotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    if (notificationsEnabled) {
      await unregisterFCMToken();
      setNotificationsEnabled(false);
    } else {
      const success = await registerFCMToken();
      setNotificationsEnabled(success);
      if (!success) {
        // ✅ alert() → toast
        toast.error("알림 권한을 허용해주세요. 브라우저 설정에서 알림을 허용할 수 있습니다.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">📬 알림 설정</h3>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">푸시 알림</p>
          <p className="text-sm text-gray-500">새 메시지와 통화 요청을 알림으로 받습니다</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
            notificationsEnabled ? "bg-blue-600" : "bg-gray-300"
          } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
              notificationsEnabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {notificationsEnabled && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            ✅ 알림이 활성화되었습니다. 앱을 닫아도 새 메시지 알림을 받을 수 있습니다.
          </p>
        </div>
      )}

      {"Notification" in window && !notificationsEnabled && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ 알림이 비활성화되어 있습니다. 앱을 닫으면 메시지 알림을 받을 수 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
