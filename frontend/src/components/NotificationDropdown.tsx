"use client";

import { NotificationItem } from "./NotificationItem";
import type { Notification } from "./NotificationIcon";

interface NotificationDropdownProps {
  notifications: Notification[];
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function NotificationDropdown({
  notifications,
  isLoading,
  onClose,
  onRefresh,
}: NotificationDropdownProps) {
  // Sort: unread first, then by date
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.is_read !== b.is_read) {
      return a.is_read ? 1 : -1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Group by priority
  const urgentNotifs = sortedNotifications.filter(
    (n) => n.priority === "urgent" && !n.is_read
  );
  const otherNotifs = sortedNotifications.filter(
    (n) => n.priority !== "urgent" || n.is_read
  );

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-[600px] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No notifications</div>
        ) : (
          <>
            {/* Urgent Section */}
            {urgentNotifs.length > 0 && (
              <div className="border-b border-gray-200">
                <div className="px-4 py-2 bg-red-50 text-xs font-semibold text-red-800 uppercase">
                  Urgent ({urgentNotifs.length})
                </div>
                {urgentNotifs.map((notification) => (
                  <NotificationItem
                    key={notification.notification_id}
                    notification={notification}
                    onClose={onClose}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}

            {/* Other Notifications */}
            {otherNotifs.length > 0 && (
              <div>
                {urgentNotifs.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    Other
                  </div>
                )}
                {otherNotifs.map((notification) => (
                  <NotificationItem
                    key={notification.notification_id}
                    notification={notification}
                    onClose={onClose}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 text-center">
          <button
            onClick={onClose}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
