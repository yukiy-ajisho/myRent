"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
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

  // Extract payment date from message and calculate countdown
  const countdownInfo = useMemo(() => {
    // Process payment_reminder and repayment_reminder notifications
    if (
      notification.type !== "payment_reminder" &&
      notification.type !== "repayment_reminder"
    ) {
      return null;
    }

    // Parse date from message:
    // Payment: "Your bill is due on November 5, 2025 for [Property]"
    // Repayment: "Your repayment of $500 is due on November 1, 2025"
    // Try to extract date string like "November 5, 2025"
    const dateMatch = notification.message.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/
    );

    if (!dateMatch) {
      return null;
    }

    try {
      const dueDate = new Date(dateMatch[0]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let text = "";
      let className = "";

      if (daysRemaining < 0) {
        text = `Overdue by ${Math.abs(daysRemaining)} day${
          Math.abs(daysRemaining) !== 1 ? "s" : ""
        }`;
        className = "bg-red-100 text-red-800 border-red-200";
      } else if (daysRemaining === 0) {
        text = "Due today";
        className = "bg-orange-100 text-orange-800 border-orange-200";
      } else if (daysRemaining === 1) {
        text = "Due tomorrow";
        className = "bg-yellow-100 text-yellow-800 border-yellow-200";
      } else {
        text = `Due in ${daysRemaining} days`;
        className = "bg-blue-100 text-blue-800 border-blue-200";
      }

      return { text, className, daysRemaining };
    } catch (error) {
      console.error("Error parsing payment date:", error);
      return null;
    }
  }, [notification.message, notification.type]);

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

          {/* Countdown Badge (for payment reminders) */}
          {countdownInfo && (
            <div className="mt-2">
              <span
                className={`inline-block px-2 py-1 text-xs font-semibold rounded border ${countdownInfo.className}`}
              >
                {countdownInfo.text}
              </span>
            </div>
          )}

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
