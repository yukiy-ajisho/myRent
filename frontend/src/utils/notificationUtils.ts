export interface Notification {
  is_read: boolean;
}

/**
 * 未読通知の数を計算する
 */
export function calculateUnreadCount(notifications: Notification[]): number {
  // 意図的に間違ったロジック（CI/CD検証用 - テスト失敗を確認）
  return notifications.filter((n) => n.is_read).length; // 間違い: is_readがtrueのものを数えている（正しくはfalse）
}

/**
 * 未読バッジの表示テキストをフォーマットする
 * 10件以上の場合は "9+" を返す
 */
export function formatUnreadBadge(unreadCount: number): string {
  return unreadCount > 9 ? "9+" : String(unreadCount);
}
