# Notification System Setup Guide

## ✅ What Has Been Implemented

### 1. Database Tables

- `notification` - Main notification table (generic)
- `notification_loan` - Loan-specific notification data
- `notification_repayment` - Repayment-specific notification data

**To create tables:** Run the SQL in `database_notifications.sql` in your Supabase SQL editor.

---

### 2. Backend API Endpoints

- `GET /notifications` - Get all notifications for current user
- `PUT /notifications/:notificationId/read` - Mark notification as read
- `DELETE /notifications/:notificationId` - Delete notification
- Helper function: `createNotification()` - Used to create notifications

---

### 3. Frontend API Functions

- `api.getNotifications()`
- `api.markNotificationAsRead(notificationId)`
- `api.deleteNotification(notificationId)`

---

### 4. React Components

- `NotificationIcon.tsx` - Bell icon with badge
- `NotificationDropdown.tsx` - Dropdown panel
- `NotificationItem.tsx` - Individual notification item

---

### 5. UI Integration

- ✅ Owner layout header - Bell icon added
- ✅ Tenant layout header - Bell icon added

---

## 🚀 Next Steps

### Phase 1: Test the Infrastructure

1. Create the database tables in Supabase
2. Restart backend server
3. Test bell icon appears in header
4. Manually create a test notification in Supabase to verify display

---

### Phase 2: Implement Loan Notifications

We need to add notification creation when:

#### A. Owner creates loan → Notify tenant

**Location:** `backend/server.js` - `POST /loans` endpoint (around line 4265)

**Add after loan creation:**

```javascript
// Get owner name
const { data: ownerData } = await supabase
  .from("app_user")
  .select("name")
  .eq("user_id", userId)
  .single();

// Create notification
const notification = await createNotification({
  userId: tenant_user_id,
  type: "loan_created",
  priority: "info",
  title: "New Loan Created",
  message: `You have a new loan of ¥${amount.toLocaleString()} from ${
    ownerData?.name || "Owner"
  }`,
  actionUrl: "/tenant/loan",
  actionLabel: "View Loan",
});

// Add loan-specific data
if (notification) {
  await supabase.from("notification_loan").insert({
    notification_id: notification.notification_id,
    loan_id: newLoan.loan_id,
    owner_id: userId,
    tenant_id: tenant_user_id,
    property_id: property_id,
    amount: amount,
    owner_name: ownerData?.name,
    tenant_name: tenantData?.name,
  });
}
```

---

#### B. Tenant creates repayment → Notify owner

**Location:** `backend/server.js` - `POST /repayments` endpoint (around line 4637)

**Add after repayment creation:**

```javascript
// Get tenant name
const { data: tenantData } = await supabase
  .from("app_user")
  .select("name")
  .eq("user_id", userId)
  .single();

// Create notification
const notification = await createNotification({
  userId: owner_user_id,
  type: "repayment_request",
  priority: "urgent",
  title: "New Repayment Request",
  message: `${
    tenantData?.name || "Tenant"
  } sent a repayment request: ¥${amount.toLocaleString()}`,
  actionUrl: "/owner/loan",
  actionLabel: "Confirm Payment",
});

// Add repayment-specific data
if (notification) {
  await supabase.from("notification_repayment").insert({
    notification_id: notification.notification_id,
    repayment_id: newRepayment.repayment_id,
    owner_id: owner_user_id,
    tenant_id: userId,
    amount: amount,
    tenant_name: tenantData?.name,
    repayment_date: newRepayment.repayment_date,
  });
}
```

---

## 📊 Testing Checklist

```
□ Database tables created
□ Backend server restarted
□ Bell icon visible in Owner header
□ Bell icon visible in Tenant header
□ Can click bell icon to open dropdown
□ Manually create test notification - displays correctly
□ Click notification - marks as read
□ Click notification - navigates to correct page
□ Unread badge shows correct count
□ Loan creation triggers tenant notification
□ Repayment creation triggers owner notification
```

---

## 🎨 UI Features

- 🔴 Urgent notifications (red badge)
- 🟠 Important notifications
- 🟢 Info notifications
- Unread notifications highlighted in blue
- Relative time display (e.g., "2h ago")
- Auto-refresh every 30 seconds
- Click to navigate + mark as read

---

## 🔮 Future Enhancements

Ready to add more notification types:

- Bill calculation reminders
- Overdue balance alerts
- Payment recorded
- Inactive tenant alerts

Just create new tables like:

- `notification_bill_reminder`
- `notification_overdue_balance`

And add notification creation in the relevant endpoints!
