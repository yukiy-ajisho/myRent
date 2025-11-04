"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { NotificationDropdown } from "./NotificationDropdown";
import {
  calculateUnreadCount,
  formatUnreadBadge,
} from "@/utils/notificationUtils";

export interface Notification {
  notification_id: string;
  type: string;
  priority: "urgent" | "important" | "info";
  title: string;
  message: string;
  action_url?: string | null;
  action_label?: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationIcon() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Unread count
  const unreadCount = calculateUnreadCount(notifications);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch + polling every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="h-6 w-6" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-600 rounded-full">
            {formatUnreadBadge(unreadCount)}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <NotificationDropdown
            notifications={notifications}
            isLoading={isLoading}
            onClose={() => setIsOpen(false)}
            onRefresh={fetchNotifications}
          />
        </>
      )}
    </div>
  );
}
