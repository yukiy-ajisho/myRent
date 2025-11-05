import { calculateUnreadCount, formatUnreadBadge } from "../notificationUtils";

describe("calculateUnreadCount", () => {
  it("returns 0 when all notifications are read", () => {
    const notifications = [
      { is_read: true },
      { is_read: true },
      { is_read: true },
    ];
    expect(calculateUnreadCount(notifications)).toBe(0);
  });

  it("returns correct count when some notifications are unread", () => {
    const notifications = [
      { is_read: false },
      { is_read: true },
      { is_read: false },
      { is_read: false },
    ];
    // 意図的に間違った期待値（CI/CD検証用）
    expect(calculateUnreadCount(notifications)).toBe(999);
  });

  it("returns 0 when notifications array is empty", () => {
    expect(calculateUnreadCount([])).toBe(0);
  });

  it("handles all unread notifications", () => {
    const notifications = [
      { is_read: false },
      { is_read: false },
      { is_read: false },
    ];
    expect(calculateUnreadCount(notifications)).toBe(3);
  });
});

describe("formatUnreadBadge", () => {
  it("returns the number as string when count is 9 or less", () => {
    expect(formatUnreadBadge(0)).toBe("0");
    expect(formatUnreadBadge(5)).toBe("5");
    expect(formatUnreadBadge(9)).toBe("9");
  });

  it("returns '9+' when count is greater than 9", () => {
    expect(formatUnreadBadge(10)).toBe("9+");
    expect(formatUnreadBadge(15)).toBe("9+");
    expect(formatUnreadBadge(99)).toBe("9+");
  });
});
