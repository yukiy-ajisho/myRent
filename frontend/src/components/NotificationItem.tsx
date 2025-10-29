"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Notification } from "./NotificationIcon";

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
  onRefresh: () => void;
}

export function NotificationItem({
  notification,
  onClose,
  onRefresh,
}: NotificationItemProps) {
  const router = useRouter();

  // Priority icon
  const getPriorityIcon = () => {
    switch (notification.priority) {
      case "urgent":
        return "🔴";
      case "important":
        return "🟠";
      case "info":
        return "🟢";
      default:
        return "⚪";
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Handle click
  const handleClick = async () => {
    try {
      // Mark as read
      if (!notification.is_read) {
        await api.markNotificationAsRead(notification.notification_id);
      }

      // Navigate if action_url exists
      if (notification.action_url) {
        router.push(notification.action_url);
      }

      onClose();
      onRefresh();
    } catch (error) {
      console.error("Error handling notification click:", error);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
        !notification.is_read ? "bg-blue-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Priority Icon */}
        <span className="text-lg flex-shrink-0 mt-0.5">
          {getPriorityIcon()}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4
            className={`text-sm font-semibold text-gray-900 ${
              !notification.is_read ? "font-bold" : ""
            }`}
          >
            {notification.title}
          </h4>

          {/* Message */}
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {notification.message}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {formatTime(notification.created_at)}
            </span>

            {notification.action_label && (
              <span className="text-xs text-blue-600 font-medium">
                {notification.action_label} →
              </span>
            )}
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.is_read && (
          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
        )}
      </div>
    </div>
  );
}
