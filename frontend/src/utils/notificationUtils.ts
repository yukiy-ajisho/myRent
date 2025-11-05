export interface Notification {
  is_read: boolean;
}

/**
 * 未読通知の数を計算する
 */
export function calculateUnreadCount(notifications: Notification[]): number {
  // 意図的に型エラーを追加（CI/CD検証用）
  return "wrong type"; // TypeScriptエラー: stringを返しているが戻り値型はnumber
}

/**
 * 未読バッジの表示テキストをフォーマットする
 * 10件以上の場合は "9+" を返す
 */
export function formatUnreadBadge(unreadCount: number): string {
  return unreadCount > 9 ? "9+" : String(unreadCount);
}
