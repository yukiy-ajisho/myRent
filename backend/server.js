const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://my-rent.vercel.app",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// JWT verification middleware
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);

    // Verify JWT with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    res.status(401).json({ error: "Token verification failed" });
  }
};

// Apply JWT verification to all routes
app.use(verifyJWT);

// GET /user-properties - 認証されたユーザーが管理するプロパティ一覧
app.get("/user-properties", async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: userProperties, error } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          timezone,
          active
        )
      `
      )
      .eq("user_id", userId);

    if (error) throw error;

    res.json({ properties: userProperties });
  } catch (error) {
    console.error("User properties error:", error);
    res.status(500).json({ error: "Failed to fetch user properties" });
  }
});

// POST /check-user - ユーザー存在確認
app.post("/check-user", async (req, res) => {
  try {
    const { user_id } = req.body;

    const { data: user, error } = await supabase
      .from("app_user")
      .select("user_id")
      .eq("user_id", user_id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    res.json({ exists: !!user });
  } catch (error) {
    console.error("Check user error:", error);
    res.status(500).json({ error: "Failed to check user" });
  }
});

// GET /bill-line - 全プロパティのbill_lineデータを取得
app.get("/bill-line", async (req, res) => {
  try {
    const userId = req.user.id;

    // ユーザーがアクセス権限を持つプロパティを取得
    const { data: userProperties, error: userPropertiesError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId);

    if (userPropertiesError) throw userPropertiesError;

    if (!userProperties || userProperties.length === 0) {
      return res.json({ billLines: [] });
    }

    const propertyIds = userProperties.map((up) => up.property_id);

    // 1. ユーザーのプロパティのbill_runテーブルからbill_run_idを取得
    const { data: billRuns, error: billRunsError } = await supabase
      .from("bill_run")
      .select("bill_run_id, property_id")
      .in("property_id", propertyIds);

    if (billRunsError) throw billRunsError;

    if (!billRuns || billRuns.length === 0) {
      return res.json({ billLines: [] });
    }

    // 2. bill_run_idのリストを取得
    const billRunIds = billRuns.map((run) => run.bill_run_id);

    // 3. bill_run_idでbill_lineテーブルからデータを取得（関連テーブルも含む）
    const { data: billLines, error } = await supabase
      .from("bill_line")
      .select(
        `
        bill_line_id,
        user_id,
        utility,
        amount,
        bill_run_id,
        app_user!left(name),
        bill_run!left(month_start, property_id)
      `
      )
      .in("bill_run_id", billRunIds);

    if (error) {
      console.error("Bill line query error:", error);
      throw error;
    }

    // 4. ニックネームを取得
    const tenantIds =
      billLines
        ?.map((bl) => bl.user_id)
        .filter((id, index, arr) => arr.indexOf(id) === index) || []; // 重複除去

    console.log("=== DEBUG: Bill line nickname fetching ===");
    console.log("Tenant IDs:", tenantIds);

    let nicknames = {};
    if (tenantIds.length > 0) {
      const { data: ownerTenants, error: nickError } = await supabase
        .from("owner_tenant")
        .select("tenant_id, nick_name")
        .eq("owner_id", userId)
        .in("tenant_id", tenantIds);

      console.log("Owner tenants query result:", ownerTenants);
      console.log("Nickname query error:", nickError);

      if (nickError) {
        console.error("Error fetching nicknames:", nickError);
      } else {
        nicknames =
          ownerTenants?.reduce((acc, ot) => {
            acc[ot.tenant_id] = ot.nick_name;
            return acc;
          }, {}) || {};
        console.log("Final nicknames object:", nicknames);
      }
    }

    // 5. ニックネームをbillLinesに追加
    const billLinesWithNicknames =
      billLines?.map((billLine) => ({
        ...billLine,
        app_user: {
          ...billLine.app_user,
          nick_name: nicknames[billLine.user_id] || null,
        },
      })) || [];

    console.log("=== DEBUG: Final bill lines with nicknames ===");
    console.log("First bill line:", billLinesWithNicknames[0]);

    console.log("All bill lines fetched:", billLinesWithNicknames?.length || 0);

    res.json({ billLines: billLinesWithNicknames });
  } catch (error) {
    console.error("Bill line error:", error);
    res.status(500).json({ error: "Failed to fetch bill line data" });
  }
});

// GET /user/:userId - ユーザー情報を取得
app.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;

    console.log(
      `[SECURITY] User ${requestingUserId} requesting info for user ${userId}`
    );

    // セキュリティチェック: リクエストユーザーのプロパティを取得
    const { data: userProperties, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", requestingUserId);

    console.log(`[DEBUG] Requesting user properties check:`, {
      userProperties,
      accessError,
    });

    if (accessError || !userProperties || userProperties.length === 0) {
      console.log(
        `[SECURITY] Access denied for user ${requestingUserId}: no property access`
      );
      return res.status(403).json({ error: "Access denied" });
    }

    const propertyIds = userProperties.map((up) => up.property_id);

    // 対象ユーザーがリクエストユーザーのいずれかのプロパティにいるかチェック
    const { data: targetUserProperty, error: targetError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .in("property_id", propertyIds)
      .single();

    console.log(`[DEBUG] Target user property check:`, {
      userId,
      propertyIds,
      targetUserProperty,
      targetError,
    });

    if (targetError || !targetUserProperty) {
      console.log(
        `[SECURITY] User ${userId} not found in any of user's properties: ${propertyIds.join(
          ", "
        )}`
      );
      return res
        .status(403)
        .json({ error: "User not found in your properties" });
    }

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_id, name, email")
      .eq("user_id", userId)
      .single();

    console.log(`[DEBUG] App user lookup:`, { userId, user, userError });

    if (userError || !user) {
      console.log(`[SECURITY] User ${userId} not found in app_user table`);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[SECURITY] User info retrieved for ${userId}: ${user.name}`);
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

app.get("/bill-line/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // ユーザーがこのプロパティにアクセス権限があるかチェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 1. property_idでbill_runテーブルからbill_run_idを取得
    const { data: billRuns, error: billRunsError } = await supabase
      .from("bill_run")
      .select("bill_run_id")
      .eq("property_id", propertyId);

    if (billRunsError) throw billRunsError;

    if (!billRuns || billRuns.length === 0) {
      return res.json({ billLines: [] });
    }

    // 2. bill_run_idのリストを取得
    const billRunIds = billRuns.map((run) => run.bill_run_id);

    // 3. bill_run_idでbill_lineテーブルからデータを取得（関連テーブルも含む）
    const { data: billLines, error } = await supabase
      .from("bill_line")
      .select(
        `
        bill_line_id,
        user_id,
        utility,
        amount,
        bill_run_id,
        app_user!left(name),
        bill_run!left(month_start, property_id)
      `
      )
      .in("bill_run_id", billRunIds);

    if (error) {
      console.error("Bill line query error:", error);
      throw error;
    }

    console.log("Bill lines fetched:", billLines);
    if (billLines && billLines.length > 0) {
      console.log("First bill line:", billLines[0]);
      console.log("app_user:", billLines[0].app_user);
      console.log("bill_run:", billLines[0].bill_run);
    }

    res.json({ billLines });
  } catch (error) {
    console.error("Bill line error:", error);
    res.status(500).json({ error: "Failed to fetch bill line data" });
  }
});

// GET /stay-data/:propertyId - プロパティの滞在・休憩データ取得
app.get("/stay-data/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(
      `[SECURITY] User ${userId} requesting stay data for property ${propertyId}`
    );

    // ユーザーがこのプロパティにアクセス権限があるかチェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${propertyId}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // テナントユーザーを取得
    const { data: userPropertiesForTenants, error: userPropsError } =
      await supabase
        .from("user_property")
        .select(
          `
        user_id,
        app_user!inner(
          user_id,
          name,
          email,
          user_type
        )
      `
        )
        .eq("property_id", propertyId);

    if (userPropsError) throw userPropsError;

    const tenants = userPropertiesForTenants
      .map((up) => up.app_user)
      .filter((user) => user.user_type === "tenant");

    console.log(
      `[SECURITY] Found ${tenants.length} tenants for property ${propertyId}`
    );

    // 滞在記録を取得
    const { data: stayRecords, error: stayError } = await supabase
      .from("stay_record")
      .select("*")
      .eq("property_id", propertyId);

    if (stayError) throw stayError;

    console.log(
      `[SECURITY] Found ${stayRecords.length} stay records for property ${propertyId}`
    );

    // 休憩記録を取得（stay_recordとJOIN）
    const { data: breakRecords, error: breakError } = await supabase
      .from("break_record")
      .select(
        `
        break_id,
        stay_id,
        break_start,
        break_end,
        stay_record!inner(
          user_id,
          property_id
        )
      `
      )
      .eq("stay_record.property_id", propertyId);

    if (breakError) throw breakError;

    console.log(
      `[SECURITY] Found ${breakRecords.length} break records for property ${propertyId}`
    );

    res.json({
      tenants,
      stayRecords,
      breakRecords,
    });
  } catch (error) {
    console.error("[SECURITY] Stay data error:", error);
    res.status(500).json({ error: "Failed to fetch stay data" });
  }
});

// GET /properties - オーナーのプロパティ一覧取得
app.get("/properties", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting properties`);

    // 1. オーナー権限の確認
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (ownerError || !ownerCheck || ownerCheck.user_type !== "owner") {
      console.log(`[SECURITY] Access denied for user ${userId}: not an owner`);
      return res.status(403).json({ error: "Owner access required" });
    }

    // 2. オーナーのプロパティを取得
    const { data: userProperties, error: userPropsError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property!inner(
          property_id,
          name,
          active,
          address
        ),
        app_user!inner(
          user_type
        )
      `
      )
      .eq("user_id", userId)
      .eq("app_user.user_type", "owner");

    if (userPropsError) throw userPropsError;

    console.log(
      `[SECURITY] Found ${userProperties.length} properties for owner ${userId}`
    );

    // 3. 各プロパティのテナントを安全に取得
    const propertiesWithTenants = await Promise.all(
      userProperties.map(async (userProp) => {
        const property = userProp.property;

        // テナント情報を取得（プロパティ所有権は既に確認済み）
        const { data: tenants, error: tenantsError } = await supabase
          .from("user_property")
          .select(`app_user!inner(name)`)
          .eq("property_id", property.property_id)
          .eq("app_user.user_type", "tenant");

        if (tenantsError) throw tenantsError;

        return {
          property_id: property.property_id,
          name: property.name,
          active: property.active,
          address: property.address,
          tenants: tenants.map((t) => t.app_user.name),
        };
      })
    );

    res.json({ properties: propertiesWithTenants });
  } catch (error) {
    console.error("[SECURITY] Properties fetch error:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// POST /properties - 新しいプロパティ作成
app.post("/properties", async (req, res) => {
  try {
    const { name, address } = req.body;
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} creating property: ${name}`);

    // 1. 入力値検証
    if (!name || !address) {
      return res
        .status(400)
        .json({ error: "Property name and address are required" });
    }

    if (name.length > 100 || address.length > 200) {
      return res
        .status(400)
        .json({ error: "Property name or address too long" });
    }

    // 2. オーナー権限の確認
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (ownerError || !ownerCheck || ownerCheck.user_type !== "owner") {
      console.log(`[SECURITY] Access denied for user ${userId}: not an owner`);
      return res.status(403).json({ error: "Owner access required" });
    }

    // 3. 重複プロパティ名チェック（同じオーナー内で）
    const { data: existingProperties, error: checkError } = await supabase
      .from("user_property")
      .select(
        `
        property!inner(
          name
        ),
        app_user!inner(
          user_type
        )
      `
      )
      .eq("user_id", userId)
      .eq("app_user.user_type", "owner");

    if (checkError) throw checkError;

    const duplicateProperty = existingProperties.find(
      (up) => up.property.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicateProperty) {
      return res
        .status(400)
        .json({ error: "Property with this name already exists" });
    }

    // 4. プロパティ作成
    const { data: newProperty, error: propertyError } = await supabase
      .from("property")
      .insert({
        name: name.trim(),
        address: address.trim(),
        active: true,
        owner_id: userId,
      })
      .select("property_id")
      .single();

    if (propertyError) throw propertyError;

    console.log(`[SECURITY] Property created: ${newProperty.property_id}`);

    // 5. オーナーとプロパティの関連付け
    const { error: relationError } = await supabase
      .from("user_property")
      .insert({
        user_id: userId,
        property_id: newProperty.property_id,
      });

    if (relationError) throw relationError;

    console.log(`[SECURITY] Property ownership created for user ${userId}`);

    res.json({
      success: true,
      message: "Property created successfully",
      property_id: newProperty.property_id,
    });
  } catch (error) {
    console.error("[SECURITY] Property creation error:", error);
    res.status(500).json({ error: "Failed to create property" });
  }
});

// GET /payments - 全プロパティの支払いレコード取得
app.get("/payments", async (req, res) => {
  try {
    const userId = req.user.id;

    // ユーザーがアクセス権限を持つプロパティを取得
    const { data: userProperties, error: userPropertiesError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId);

    if (userPropertiesError) throw userPropertiesError;

    if (!userProperties || userProperties.length === 0) {
      return res.json({ payments: [] });
    }

    const propertyIds = userProperties.map((up) => up.property_id);

    // 支払いレコードをテナント名と一緒に取得
    const { data: payments, error: paymentsError } = await supabase
      .from("payment")
      .select(
        `
        payment_id,
        user_id,
        property_id,
        amount,
        note,
        paid_at,
        app_user!inner(
          name,
          email
        )
      `
      )
      .in("property_id", propertyIds)
      .order("paid_at", { ascending: false });

    if (paymentsError) throw paymentsError;

    // ニックネームを取得
    const tenantIds =
      payments
        ?.map((p) => p.user_id)
        .filter((id, index, arr) => arr.indexOf(id) === index) || []; // 重複除去

    console.log("=== DEBUG: Payment nickname fetching ===");
    console.log("Tenant IDs:", tenantIds);

    let nicknames = {};
    if (tenantIds.length > 0) {
      const { data: ownerTenants, error: nickError } = await supabase
        .from("owner_tenant")
        .select("tenant_id, nick_name")
        .eq("owner_id", userId)
        .in("tenant_id", tenantIds);

      console.log("Owner tenants query result:", ownerTenants);
      console.log("Nickname query error:", nickError);

      if (nickError) {
        console.error("Error fetching nicknames:", nickError);
      } else {
        nicknames =
          ownerTenants?.reduce((acc, ot) => {
            acc[ot.tenant_id] = ot.nick_name;
            return acc;
          }, {}) || {};
        console.log("Final nicknames object:", nicknames);
      }
    }

    // 既にledgerに反映済みの支払いをチェック（確認日時も取得）
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from("ledger")
      .select("source_id, posted_at")
      .eq("source_type", "payment")
      .in(
        "source_id",
        payments.map((p) => p.payment_id)
      );

    if (ledgerError) throw ledgerError;

    // 確認日時をマップに変換
    const confirmedAtMap = new Map();
    ledgerEntries.forEach((entry) => {
      confirmedAtMap.set(entry.source_id, entry.posted_at);
    });

    // 支払いレコードに承認ステータスと確認日時を追加
    const paymentsWithStatus = payments.map((payment) => ({
      ...payment,
      app_user: {
        ...payment.app_user,
        nick_name: nicknames[payment.user_id] || null,
      },
      isAccepted: confirmedAtMap.has(payment.payment_id),
      confirmedAt: confirmedAtMap.get(payment.payment_id) || null,
    }));

    res.json({
      payments: paymentsWithStatus,
    });
  } catch (error) {
    console.error("Payments error:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// GET /payments/:propertyId - プロパティの支払いレコード取得
app.get("/payments/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // ユーザーがこのプロパティにアクセス権限があるかチェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 支払いレコードをテナント名と一緒に取得
    const { data: payments, error: paymentsError } = await supabase
      .from("payment")
      .select(
        `
        payment_id,
        user_id,
        property_id,
        amount,
        note,
        paid_at,
        app_user!inner(
          name,
          email
        )
      `
      )
      .eq("property_id", propertyId)
      .order("paid_at", { ascending: false });

    if (paymentsError) throw paymentsError;

    // 既にledgerに反映済みの支払いをチェック（確認日時も取得）
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from("ledger")
      .select("source_id, posted_at")
      .eq("source_type", "payment")
      .in(
        "source_id",
        payments.map((p) => p.payment_id)
      );

    if (ledgerError) throw ledgerError;

    // 確認日時をマップに変換
    const confirmedAtMap = new Map();
    ledgerEntries.forEach((entry) => {
      confirmedAtMap.set(entry.source_id, entry.posted_at);
    });

    // 支払いレコードに承認ステータスと確認日時を追加
    const paymentsWithStatus = payments.map((payment) => ({
      ...payment,
      app_user: {
        ...payment.app_user,
        nick_name: nicknames[payment.user_id] || null,
      },
      isAccepted: confirmedAtMap.has(payment.payment_id),
      confirmedAt: confirmedAtMap.get(payment.payment_id) || null,
    }));

    res.json({
      payments: paymentsWithStatus,
    });
  } catch (error) {
    console.error("Payments error:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// POST /payments/:paymentId/accept - 支払いを承認してledgerに追加
app.post("/payments/:paymentId/accept", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    console.log("=== PAYMENT ACCEPT DEBUG ===");
    console.log("Payment ID:", paymentId);
    console.log("User ID:", userId);

    // 支払いレコードを取得
    const { data: payment, error: paymentError } = await supabase
      .from("payment")
      .select("*")
      .eq("payment_id", paymentId)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    console.log("Payment found:", payment);

    // ユーザーがこのプロパティにアクセス権限があるかチェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", payment.property_id)
      .single();

    if (accessError || !userProperty) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 既にledgerに反映済みかチェック
    const { data: existingLedger, error: ledgerCheckError } = await supabase
      .from("ledger")
      .select("ledger_id")
      .eq("source_type", "payment")
      .eq("source_id", paymentId)
      .single();

    if (existingLedger) {
      return res.status(400).json({ error: "Payment already accepted" });
    }

    // 現在の累積残高を取得
    const { data: currentLedger, error: currentLedgerError } = await supabase
      .from("ledger")
      .select("amount")
      .eq("user_id", payment.user_id)
      .eq("property_id", payment.property_id)
      .order("posted_at", { ascending: false })
      .limit(1);

    if (currentLedgerError) throw currentLedgerError;

    // 新しい累積残高を計算
    const currentBalance =
      currentLedger?.length > 0 ? currentLedger[0].amount : 0;
    const newBalance = currentBalance - payment.amount;

    console.log("Current balance:", currentBalance);
    console.log("Payment amount:", payment.amount);
    console.log("New balance:", newBalance);

    // ledgerテーブルに追加
    const { data: newLedgerEntry, error: ledgerError } = await supabase
      .from("ledger")
      .insert({
        user_id: payment.user_id,
        property_id: payment.property_id,
        source_type: "payment",
        source_id: paymentId,
        amount: newBalance,
        posted_at: new Date().toISOString(),
      })
      .select("ledger_id")
      .single();

    if (ledgerError) throw ledgerError;

    console.log("Ledger entry created:", newLedgerEntry);

    res.json({
      success: true,
      message: "Payment accepted successfully",
      ledger_id: newLedgerEntry.ledger_id,
      new_balance: newBalance,
    });
  } catch (error) {
    console.error("Payment accept error:", error);
    res.status(500).json({ error: "Failed to accept payment" });
  }
});

// POST /add-tenant - テナント追加（新規作成 or 既存テナント追加）
app.post("/add-tenant", async (req, res) => {
  try {
    const { email, propertyId } = req.body;
    const userId = req.user.id;

    // ユーザーがこのプロパティにアクセス権限があるかチェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 既存ユーザーかチェック（メールアドレスのみで検索）
    const { data: existingUser, error: searchError } = await supabase
      .from("app_user")
      .select("user_id, user_type, name")
      .eq("email", email)
      .single();

    let tenantUserId;

    if (existingUser) {
      // 既存ユーザーが見つかった場合
      if (existingUser.user_type === "owner") {
        return res.status(400).json({ error: "Cannot add the tenant" });
      }

      // 既存テナントの場合
      tenantUserId = existingUser.user_id;

      // 既にこのプロパティに所属していないかチェック
      const { data: existingRelation } = await supabase
        .from("user_property")
        .select("user_id")
        .eq("user_id", tenantUserId)
        .eq("property_id", propertyId)
        .single();

      if (existingRelation) {
        return res
          .status(400)
          .json({ error: "Tenant already exists in this property" });
      }
    } else {
      // 既存ユーザーが見つからない場合はエラー
      return res.status(404).json({
        error: "Tenant not found.",
      });
    }

    // プロパティに所属させる
    const { error: relationError } = await supabase
      .from("user_property")
      .insert({
        user_id: tenantUserId,
        property_id: propertyId,
      });

    if (relationError) throw relationError;

    // 初期レジャーレコードを作成
    const sourceId = Math.floor(Math.random() * 1000000000); // int8型
    const { error: ledgerError } = await supabase.from("ledger").insert({
      user_id: tenantUserId,
      property_id: parseInt(propertyId),
      source_type: "initial",
      source_id: sourceId, // ランダム数値を使用
      amount: 0, // 開始残高
      posted_at: new Date().toISOString(),
    });

    if (ledgerError) throw ledgerError;

    res.json({
      success: true,
      message: "Tenant added to property successfully",
      tenantName: existingUser.name,
    });
  } catch (error) {
    console.error("Add tenant error:", error);
    res.status(500).json({ error: "Failed to add tenant" });
  }
});

// GET /rent-data - 全プロパティのテナントデータ取得
app.get("/rent-data", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting all tenant data`);

    // 1. ユーザーがアクセス権限を持つプロパティを取得
    const { data: userProperties, error: userPropertiesError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId);

    if (userPropertiesError) throw userPropertiesError;

    if (!userProperties || userProperties.length === 0) {
      return res.json({ tenants: [], tenantRents: [] });
    }

    const propertyIds = userProperties.map((up) => up.property_id);

    // 2. 全プロパティのテナントを取得
    const { data: allUserProperties, error: userPropsError } = await supabase
      .from("user_property")
      .select(
        `
        user_id,
        property_id,
        app_user!inner(
          user_id,
          name,
          email,
          user_type,
          personal_multiplier,
          phone_number
        ),
        property:property_id(name)
        `
      )
      .in("property_id", propertyIds);

    if (userPropsError) throw userPropsError;

    // 3. ニックネームを取得
    const tenantIds = allUserProperties
      .filter((up) => up.app_user.user_type === "tenant")
      .map((up) => up.app_user.user_id);

    console.log("=== DEBUG: Nickname fetching ===");
    console.log("Tenant IDs:", tenantIds);

    let nicknames = {};
    if (tenantIds.length > 0) {
      const { data: ownerTenants, error: nickError } = await supabase
        .from("owner_tenant")
        .select("tenant_id, nick_name")
        .eq("owner_id", userId)
        .in("tenant_id", tenantIds);

      console.log("Owner tenants query result:", ownerTenants);
      console.log("Nickname query error:", nickError);

      if (nickError) {
        console.error("Error fetching nicknames:", nickError);
      } else {
        nicknames =
          ownerTenants?.reduce((acc, ot) => {
            acc[ot.tenant_id] = ot.nick_name;
            return acc;
          }, {}) || {};
        console.log("Final nicknames object:", nicknames);
      }
    }

    // テナントのみをフィルタリング（オーナーを除外）
    const tenants = allUserProperties
      .map((up) => ({
        ...up.app_user,
        property_id: up.property_id,
        property_name: up.property.name,
        nick_name: nicknames[up.app_user.user_id] || null,
      }))
      .filter((user) => user.user_type === "tenant");

    console.log("=== DEBUG: Final tenant data ===");
    console.log("Tenants with nicknames:", tenants);

    console.log(
      `[SECURITY] Found ${tenants.length} tenants across all properties`
    );

    // 4. 全プロパティのテナント家賃データを取得
    const { data: allTenantRents, error: rentsError } = await supabase
      .from("tenant_rent")
      .select("*")
      .in("property_id", propertyIds);

    if (rentsError) throw rentsError;

    res.json({
      tenants,
      tenantRents: allTenantRents,
    });
  } catch (error) {
    console.error("Rent data error:", error);
    res.status(500).json({ error: "Failed to fetch rent data" });
  }
});

// GET /rent-data/:propertyId - プロパティ固有の家賃データ取得
app.get("/rent-data/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    // ユーザーがこのプロパティにアクセス権限があるかチェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // テナント家賃データを取得
    const { data: tenantRents, error: rentsError } = await supabase
      .from("tenant_rent")
      .select("*")
      .eq("property_id", propertyId);

    if (rentsError) throw rentsError;

    // テナントユーザーを取得
    const { data: userPropertiesForTenants, error: userPropsError } =
      await supabase
        .from("user_property")
        .select(
          `
        user_id,
        app_user!inner(
          user_id,
          name,
          email,
          user_type,
          personal_multiplier,
          phone_number
        )
      `
        )
        .eq("property_id", propertyId);

    if (userPropsError) throw userPropsError;

    // ニックネームを取得
    const tenantIds =
      userPropertiesForTenants
        ?.filter((up) => up.app_user.user_type === "tenant")
        ?.map((up) => up.app_user.user_id) || [];

    console.log("=== DEBUG: Rent data property nickname fetching ===");
    console.log("Tenant IDs:", tenantIds);

    let nicknames = {};
    if (tenantIds.length > 0) {
      const { data: ownerTenants, error: nickError } = await supabase
        .from("owner_tenant")
        .select("tenant_id, nick_name")
        .eq("owner_id", userId)
        .in("tenant_id", tenantIds);

      console.log("Owner tenants query result:", ownerTenants);
      console.log("Nickname query error:", nickError);

      if (nickError) {
        console.error("Error fetching nicknames:", nickError);
      } else {
        nicknames =
          ownerTenants?.reduce((acc, ot) => {
            acc[ot.tenant_id] = ot.nick_name;
            return acc;
          }, {}) || {};
        console.log("Final nicknames object:", nicknames);
      }
    }

    const tenants = userPropertiesForTenants
      .map((up) => ({
        ...up.app_user,
        nick_name: nicknames[up.app_user.user_id] || null,
      }))
      .filter((user) => user.user_type === "tenant");

    console.log("=== DEBUG: Final tenants with nicknames ===");
    console.log("First tenant:", tenants[0]);

    res.json({
      tenants,
      tenantRents,
    });
  } catch (error) {
    console.error("Rent data error:", error);
    res.status(500).json({ error: "Failed to fetch rent data" });
  }
});

// GET /bootstrap - 初期データ取得（ユーザーが管理するプロパティのみ）
app.get("/bootstrap", async (req, res) => {
  try {
    const { property_id, month_start } = req.query;
    const userId = req.user.id;

    // Get user's properties only
    const { data: userProperties, error: userPropsError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          timezone,
          active
        )
      `
      )
      .eq("user_id", userId);

    if (userPropsError) throw userPropsError;

    const properties = userProperties
      .map((up) => up.property)
      .filter((p) => p.active);

    // Get division rules for user's properties only
    const propertyIds = properties.map((p) => p.property_id);
    const { data: divisionRules, error: rulesError } = await supabase
      .from("division_rule_default")
      .select("*")
      .in("property_id", propertyIds);

    if (rulesError) throw rulesError;

    let utilityActuals = [];
    let tenantRents = [];

    if (property_id && month_start) {
      // Verify user has access to this property
      const hasAccess = properties.some(
        (p) => String(p.property_id) === String(property_id)
      );
      if (hasAccess) {
        const { data, error } = await supabase
          .from("utility_actual")
          .select("*")
          .eq("property_id", property_id)
          .eq("month_start", month_start);

        if (error) throw error;
        utilityActuals = data;
      }
    }

    // Get tenant rents and tenant users for user's properties only
    let tenants = [];
    if (property_id) {
      console.log("=== BOOTSTRAP DEBUG ===");
      console.log("Property ID:", property_id);
      console.log(
        "Available properties:",
        properties.map((p) => ({ id: p.property_id, name: p.name }))
      );

      const hasAccess = properties.some(
        (p) => String(p.property_id) === String(property_id)
      );
      console.log("Has access to property:", hasAccess);

      if (hasAccess) {
        // Get tenant rents
        console.log("Fetching tenant rents...");
        const { data, error } = await supabase
          .from("tenant_rent")
          .select("*")
          .eq("property_id", property_id);

        if (error) throw error;
        tenantRents = data;
        console.log("Tenant rents found:", tenantRents);

        // Get tenant users for this property
        console.log("Fetching tenant users...");
        const { data: userProperties, error: userPropsError } = await supabase
          .from("user_property")
          .select(
            `
            user_id,
            app_user!inner(
              user_id,
              name,
              email,
              user_type,
              personal_multiplier,
              phone_number
            )
          `
          )
          .eq("property_id", property_id);

        if (userPropsError) throw userPropsError;
        console.log("User properties found:", userProperties);
        console.log(
          "First user property app_user:",
          userProperties[0]?.app_user
        );

        tenants = userProperties
          .map((up) => up.app_user)
          .filter((user) => user.user_type === "tenant");
        console.log("Filtered tenants:", tenants);
      } else {
        console.log("No access to property, skipping tenant data");
      }
    }

    res.json({
      properties,
      divisionRules,
      utilityActuals,
      tenantRents,
      tenants,
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    res.status(500).json({ error: "Failed to fetch bootstrap data" });
  }
});

// POST /save-division-rules - 分割ルール保存
app.post("/save-division-rules", async (req, res) => {
  try {
    const { property_id, items } = req.body;

    if (!property_id || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Upsert division rules
    const upsertPromises = items.map((item) =>
      supabase.from("division_rule_default").upsert(
        {
          property_id,
          utility: item.utility,
          method: item.method,
        },
        {
          onConflict: "property_id,utility",
        }
      )
    );

    await Promise.all(upsertPromises);

    res.json({ ok: true });
  } catch (error) {
    console.error("Save division rules error:", error);
    res.status(500).json({ error: "Failed to save division rules" });
  }
});

// POST /save-stay-periods - 滞在期間保存 (SECURE VERSION)
app.post("/save-stay-periods", async (req, res) => {
  try {
    const { property_id, stay_periods, break_periods } = req.body;
    const userId = req.user.id; // ← ADD AUTHENTICATION

    console.log(
      `[SECURITY] User ${userId} saving stay periods for property ${property_id}`
    );

    console.log("=== DEBUG: save-stay-periods ===");
    console.log("property_id:", property_id, "type:", typeof property_id);
    console.log("stay_periods:", stay_periods);

    // ← ADD AUTHORIZATION CHECK
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", property_id)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${property_id}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    if (!property_id || !stay_periods) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Update or insert stay records for each tenant individually
    for (const [user_id, period] of Object.entries(stay_periods)) {
      if (period.startDate) {
        // Check if stay record already exists for this user and property
        const propertyIdInt = parseInt(property_id);
        if (isNaN(propertyIdInt)) {
          throw new Error(`Invalid property_id: ${property_id}`);
        }

        const { data: existingRecord, error: selectError } = await supabase
          .from("stay_record")
          .select("stay_id")
          .eq("user_id", user_id)
          .eq("property_id", propertyIdInt)
          .single();

        if (selectError && selectError.code !== "PGRST116") {
          // PGRST116 = no rows found
          throw selectError;
        }

        if (existingRecord) {
          // Update existing record
          const { error: updateError } = await supabase
            .from("stay_record")
            .update({
              start_date: period.startDate,
              end_date: period.endDate || null,
            })
            .eq("stay_id", existingRecord.stay_id);

          if (updateError) throw updateError;
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from("stay_record")
            .insert({
              user_id,
              property_id: propertyIdInt,
              start_date: period.startDate,
              end_date: period.endDate || null,
            });

          if (insertError) throw insertError;
        }
      }
    }

    // Insert new break records
    if (break_periods && Object.keys(break_periods).length > 0) {
      const breakRecords = [];

      // Get the stay_ids from the newly inserted stay records
      const { data: newStayRecords, error: staySelectError } = await supabase
        .from("stay_record")
        .select("stay_id, user_id")
        .eq("property_id", property_id);

      if (staySelectError) throw staySelectError;

      // Create a map of user_id to stay_id
      const userToStayId = {};
      newStayRecords.forEach((stay) => {
        userToStayId[stay.user_id] = stay.stay_id;
      });

      Object.entries(break_periods).forEach(([user_id, breaks]) => {
        const stay_id = userToStayId[user_id];
        if (stay_id) {
          breaks.forEach((breakPeriod) => {
            // Only create break records if both dates are provided
            if (breakPeriod.breakStart && breakPeriod.breakEnd) {
              breakRecords.push({
                stay_id,
                break_start: breakPeriod.breakStart,
                break_end: breakPeriod.breakEnd,
              });
            }
          });
        }
      });

      if (breakRecords.length > 0) {
        const { error: breakInsertError } = await supabase
          .from("break_record")
          .insert(breakRecords);

        if (breakInsertError) throw breakInsertError;
      }
    }

    console.log(
      `[SECURITY] Stay periods saved successfully for property ${property_id}`
    );

    // Count saved records
    const savedStayRecordsCount = Object.values(stay_periods).filter(
      (period) => period.startDate
    ).length;

    res.json({
      ok: true,
      stay_records_saved: savedStayRecordsCount,
      break_records_saved: break_periods
        ? Object.values(break_periods).flat().length
        : 0,
    });
  } catch (error) {
    console.error("[SECURITY] Save stay periods error:", error);
    res.status(500).json({ error: "Failed to save stay periods" });
  }
});

// POST /save-rent - 家賃保存
app.post("/save-rent", async (req, res) => {
  try {
    const { property_id, rent_amounts } = req.body;

    if (!property_id || !rent_amounts) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Upsert rent records for each user
    const rentRecords = Object.entries(rent_amounts).map(
      ([user_id, monthly_rent]) => ({
        user_id,
        property_id: parseInt(property_id),
        monthly_rent,
      })
    );

    if (rentRecords.length > 0) {
      const { error: upsertError } = await supabase
        .from("tenant_rent")
        .upsert(rentRecords, {
          onConflict: "user_id,property_id",
        });

      if (upsertError) throw upsertError;
    }

    res.json({ ok: true, records_saved: rentRecords.length });
  } catch (error) {
    console.error("Save rent error:", error);
    res.status(500).json({ error: "Failed to save rent" });
  }
});

// POST /utility-actual - ユーティリティ実績保存
app.post("/utility-actual", async (req, res) => {
  try {
    const { property_id, month_start, utility, amount } = req.body;

    if (!property_id || !month_start || !utility || amount === undefined) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Only save if amount is provided (not empty)
    if (amount !== null && amount !== "") {
      await supabase.from("utility_actual").upsert(
        {
          property_id,
          month_start,
          utility,
          amount: parseFloat(amount),
        },
        {
          onConflict: "property_id,month_start,utility",
        }
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Save utility actual error:", error);
    res.status(500).json({ error: "Failed to save utility actual" });
  }
});

// POST /calculate-bills-preview - 請求計算プレビュー（DB書き込みなし）
app.post("/calculate-bills-preview", async (req, res) => {
  try {
    const { property_id, month_start, stay_periods } = req.body;
    const userId = req.user.id;

    if (!property_id || !month_start) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    console.log(
      `[SECURITY] User ${userId} requesting bill calculation preview for property ${property_id}`
    );

    // 1. オーナー権限の確認
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (ownerError || !ownerCheck || ownerCheck.user_type !== "owner") {
      console.log(`[SECURITY] Access denied for user ${userId}: not an owner`);
      return res
        .status(403)
        .json({ error: "Owner access required for bill calculation" });
    }

    // 2. プロパティアクセス権限の確認
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", property_id)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${property_id}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 3. 重複計算の防止（同じ月の計算が既に存在するかチェック）
    const { data: existingBillRun, error: billRunError } = await supabase
      .from("bill_run")
      .select("bill_run_id, status")
      .eq("property_id", property_id)
      .eq("month_start", month_start)
      .single();

    if (billRunError && billRunError.code !== "PGRST116") {
      throw billRunError;
    }

    if (existingBillRun && existingBillRun.status === "closed") {
      console.log(
        `[SECURITY] Calculation already completed for property ${property_id}, month ${month_start}`
      );
      return res
        .status(409)
        .json({ error: "Bill calculation already completed for this month" });
    }

    console.log(
      `[SECURITY] Starting bill calculation preview for property ${property_id}, month ${month_start}`
    );

    // Calculate bills (preview mode - no DB writes)
    const result = await calculateBills(
      property_id,
      month_start,
      stay_periods,
      true
    );

    console.log(
      `[SECURITY] Bill calculation preview completed for property ${property_id}: ${result.lines_created} lines`
    );

    res.json(result);
  } catch (error) {
    console.error("Calculate bills preview error:", error);
    res.status(500).json({ error: "Failed to calculate bills preview" });
  }
});

// POST /confirm-bills-calculation - 請求計算結果の確認とDB書き込み
app.post("/confirm-bills-calculation", async (req, res) => {
  try {
    const { property_id, month_start, stay_periods, previewData } = req.body;
    const userId = req.user.id;

    if (!property_id || !month_start || !previewData) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    console.log(
      `[SECURITY] User ${userId} confirming bill calculation for property ${property_id}`
    );

    // 1. オーナー権限の確認
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (ownerError || !ownerCheck || ownerCheck.user_type !== "owner") {
      console.log(`[SECURITY] Access denied for user ${userId}: not an owner`);
      return res
        .status(403)
        .json({ error: "Owner access required for bill calculation" });
    }

    // 2. プロパティアクセス権限の確認
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", property_id)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${property_id}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 3. 重複計算の防止（同じ月の計算が既に存在するかチェック）
    const { data: existingBillRun, error: billRunError } = await supabase
      .from("bill_run")
      .select("bill_run_id, status")
      .eq("property_id", property_id)
      .eq("month_start", month_start)
      .single();

    if (billRunError && billRunError.code !== "PGRST116") {
      throw billRunError;
    }

    if (existingBillRun && existingBillRun.status === "closed") {
      console.log(
        `[SECURITY] Calculation already completed for property ${property_id}, month ${month_start}`
      );
      return res
        .status(409)
        .json({ error: "Bill calculation already completed for this month" });
    }

    console.log(
      `[SECURITY] Confirming bill calculation for property ${property_id}, month ${month_start}`
    );

    // Write preview data to database
    const result = await writePreviewDataToDatabase(
      property_id,
      month_start,
      previewData
    );

    console.log(
      `[SECURITY] Bill calculation confirmed for property ${property_id}: ${result.lines_created} lines, ${result.ledger_records_created} ledger records`
    );

    res.json(result);
  } catch (error) {
    console.error("Confirm bills calculation error:", error);
    res.status(500).json({ error: "Failed to confirm bills calculation" });
  }
});

// POST /run-bill - 請求計算実行（既存のエンドポイントを保持）
app.post("/run-bill", async (req, res) => {
  try {
    const { property_id, month_start, stay_periods } = req.body;
    const userId = req.user.id;

    if (!property_id || !month_start) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    console.log(
      `[SECURITY] User ${userId} requesting bill calculation for property ${property_id}`
    );

    // 1. オーナー権限の確認
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (ownerError || !ownerCheck || ownerCheck.user_type !== "owner") {
      console.log(`[SECURITY] Access denied for user ${userId}: not an owner`);
      return res
        .status(403)
        .json({ error: "Owner access required for bill calculation" });
    }

    // 2. プロパティアクセス権限の確認
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", property_id)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${property_id}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 3. 重複計算の防止（同じ月の計算が既に存在するかチェック）
    const { data: existingBillRun, error: billRunError } = await supabase
      .from("bill_run")
      .select("bill_run_id, status")
      .eq("property_id", property_id)
      .eq("month_start", month_start)
      .single();

    if (billRunError && billRunError.code !== "PGRST116") {
      throw billRunError;
    }

    if (existingBillRun && existingBillRun.status === "closed") {
      console.log(
        `[SECURITY] Calculation already completed for property ${property_id}, month ${month_start}`
      );
      return res
        .status(409)
        .json({ error: "Bill calculation already completed for this month" });
    }

    console.log(
      `[SECURITY] Starting bill calculation for property ${property_id}, month ${month_start}`
    );

    // Calculate bills
    const result = await calculateBills(property_id, month_start, stay_periods);

    console.log(
      `[SECURITY] Bill calculation completed for property ${property_id}: ${result.lines_created} lines, ${result.ledger_records_created} ledger records`
    );

    res.json(result);
  } catch (error) {
    console.error("Run bill error:", error);
    res.status(500).json({ error: "Failed to run bill calculation" });
  }
});

// GET /dashboard - 全プロパティのダッシュボードデータ取得
app.get("/dashboard", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting all dashboard data`);

    // 1. ユーザーがアクセス権限を持つプロパティを取得
    const { data: userProperties, error: userPropertiesError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId);

    if (userPropertiesError) throw userPropertiesError;

    if (!userProperties || userProperties.length === 0) {
      return res.json({ tenants: [] });
    }

    const propertyIds = userProperties.map((up) => up.property_id);

    // 2. 全プロパティのテナントを取得
    const { data: allUserProperties, error: userPropsError } = await supabase
      .from("user_property")
      .select(
        `
        user_id,
        property_id,
        app_user!inner(*),
        property:property_id(name)
        `
      )
      .in("property_id", propertyIds);

    if (userPropsError) throw userPropsError;

    // ニックネームを取得
    const tenantIds =
      allUserProperties
        ?.filter((up) => up.app_user.user_type === "tenant")
        ?.map((up) => up.app_user.user_id) || [];

    console.log("=== DEBUG: Dashboard nickname fetching ===");
    console.log("Tenant IDs:", tenantIds);

    let nicknames = {};
    if (tenantIds.length > 0) {
      const { data: ownerTenants, error: nickError } = await supabase
        .from("owner_tenant")
        .select("tenant_id, nick_name")
        .eq("owner_id", userId)
        .in("tenant_id", tenantIds);

      console.log("Owner tenants query result:", ownerTenants);
      console.log("Nickname query error:", nickError);

      if (nickError) {
        console.error("Error fetching nicknames:", nickError);
      } else {
        nicknames =
          ownerTenants?.reduce((acc, ot) => {
            acc[ot.tenant_id] = ot.nick_name;
            return acc;
          }, {}) || {};
        console.log("Final nicknames object:", nicknames);
      }
    }

    // テナントのみをフィルタリング（オーナーを除外）
    const tenants = allUserProperties
      .map((up) => ({
        ...up.app_user,
        property_id: up.property_id,
        property_name: up.property.name,
        nick_name: nicknames[up.app_user.user_id] || null,
      }))
      .filter((user) => user.user_type === "tenant");

    console.log(
      `[SECURITY] Found ${tenants.length} tenants across all properties`
    );

    // 3. 各テナントの最新ledgerレコードを取得
    const dashboardData = [];

    for (const tenant of tenants) {
      const { data: latestLedger, error: ledgerError } = await supabase
        .from("ledger")
        .select("amount, posted_at")
        .eq("user_id", tenant.user_id)
        .eq("property_id", tenant.property_id)
        .order("posted_at", { ascending: false })
        .limit(1)
        .single();

      if (ledgerError && ledgerError.code !== "PGRST116") {
        console.error(
          `Error fetching ledger for tenant ${tenant.user_id}:`,
          ledgerError
        );
        continue;
      }

      dashboardData.push({
        user_id: tenant.user_id,
        name: tenant.name,
        email: tenant.email,
        nick_name: tenant.nick_name,
        current_balance: latestLedger ? latestLedger.amount : 0,
        last_updated: latestLedger ? latestLedger.posted_at : null,
        property_id: tenant.property_id.toString(),
        property_name: tenant.property_name,
      });
    }

    console.log(
      `[SECURITY] Dashboard data prepared: ${dashboardData.length} tenants`
    );

    res.json({
      tenants: dashboardData,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// GET /dashboard/:propertyId - ダッシュボードデータ取得
app.get("/dashboard/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(
      `[SECURITY] User ${userId} requesting dashboard data for property ${propertyId}`
    );

    // 1. プロパティアクセス権限の確認
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${propertyId}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 2. プロパティに所属するテナントを取得
    const { data: userProperties, error: userPropsError } = await supabase
      .from("user_property")
      .select(
        `
        user_id,
        app_user!inner(*)
      `
      )
      .eq("property_id", propertyId);

    if (userPropsError) throw userPropsError;

    // テナントのみをフィルタリング（オーナーを除外）
    const tenants = userProperties
      .map((up) => up.app_user)
      .filter((user) => user.user_type === "tenant");

    console.log(
      `[SECURITY] Found ${tenants.length} tenants for property ${propertyId}`
    );

    // 3. 各テナントの最新ledgerレコードを取得
    const dashboardData = [];

    for (const tenant of tenants) {
      const { data: latestLedger, error: ledgerError } = await supabase
        .from("ledger")
        .select("amount, posted_at")
        .eq("user_id", tenant.user_id)
        .eq("property_id", propertyId)
        .order("posted_at", { ascending: false })
        .limit(1)
        .single();

      if (ledgerError && ledgerError.code !== "PGRST116") {
        console.error(
          `Error fetching ledger for tenant ${tenant.user_id}:`,
          ledgerError
        );
        continue;
      }

      dashboardData.push({
        user_id: tenant.user_id,
        name: tenant.name,
        email: tenant.email,
        current_balance: latestLedger ? latestLedger.amount : 0,
        last_updated: latestLedger ? latestLedger.posted_at : null,
      });
    }

    console.log(
      `[SECURITY] Dashboard data prepared for property ${propertyId}: ${dashboardData.length} tenants`
    );

    res.json({
      tenants: dashboardData,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// GET /dump-all - 全テーブルダンプ（ユーザーが管理するプロパティのデータのみ）
app.get("/dump-all", async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's property IDs first
    const { data: userProperties, error: userPropsError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId);

    if (userPropsError) throw userPropsError;

    const propertyIds = userProperties.map((up) => up.property_id);

    const dump = {};

    // Get properties that user manages
    const { data: properties, error: propertiesError } = await supabase
      .from("property")
      .select("*")
      .in("property_id", propertyIds);

    if (propertiesError) {
      console.error("Error fetching properties:", propertiesError);
      dump.property = { error: propertiesError.message };
    } else {
      dump.property = properties;
    }

    // Get app_user data for the current user
    const { data: appUser, error: appUserError } = await supabase
      .from("app_user")
      .select("*")
      .eq("user_id", userId);

    if (appUserError) {
      console.error("Error fetching app_user:", appUserError);
      dump.app_user = { error: appUserError.message };
    } else {
      dump.app_user = appUser;
    }

    // Get user_property data for the current user
    const { data: userProperty, error: userPropertyError } = await supabase
      .from("user_property")
      .select("*")
      .eq("user_id", userId);

    if (userPropertyError) {
      console.error("Error fetching user_property:", userPropertyError);
      dump.user_property = { error: userPropertyError.message };
    } else {
      dump.user_property = userProperty;
    }

    // Get data for tables that are filtered by property_id
    const propertyFilteredTables = [
      "stay_record",
      "break_record",
      "tenant_rent",
      "utility_actual",
      "division_rule_default",
      "bill_run",
      "bill_line",
      "payment",
      "ledger",
    ];

    for (const table of propertyFilteredTables) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .in("property_id", propertyIds);

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        dump[table] = { error: error.message };
      } else {
        dump[table] = data;
      }
    }

    res.json(dump);
  } catch (error) {
    console.error("Dump all error:", error);
    res.status(500).json({ error: "Failed to dump all tables" });
  }
});

// Calculate bills function
async function calculateBills(
  property_id,
  month_start,
  manualStayPeriods = {},
  previewMode = false
) {
  console.log(`=== DEBUG: calculateBills ===`);
  console.log(`Property ID: ${property_id}`);
  console.log(`Month Start: ${month_start}`);

  // Fix monthEnd calculation - use correct method
  console.log("month_start raw:", month_start); // 文字列
  const ms = new Date(month_start); // ここはUTC解釈
  console.log("parsed month_start:", ms.toISOString(), ms.getTime());

  const year = ms.getUTCFullYear(); // UTCで統一
  const month = ms.getUTCMonth(); // 0=Jan … 9=Oct
  const monthEnd = new Date(Date.UTC(year, month + 1, 0)); // ← 月末（UTC）
  console.log("monthEnd (UTC):", monthEnd.toISOString(), monthEnd.getTime());

  console.log(`Calculated Month End: ${monthEnd.toISOString().split("T")[0]}`);

  // Get or create bill_run (skip creation in preview mode)
  let billRun;

  if (previewMode) {
    // In preview mode, use a temporary bill_run object with a fake ID
    billRun = {
      bill_run_id: -1, // Temporary ID for preview
      property_id: property_id,
      month_start: month_start,
      status: "open",
    };
  } else {
    // Normal mode: get or create bill_run
    let { data: existingBillRun, error: billRunError } = await supabase
      .from("bill_run")
      .select("*")
      .eq("property_id", property_id)
      .eq("month_start", month_start)
      .single();

    if (billRunError && billRunError.code !== "PGRST116") {
      throw billRunError;
    }

    if (!existingBillRun) {
      const { data: newBillRun, error: createError } = await supabase
        .from("bill_run")
        .insert({
          property_id,
          month_start,
          status: "open",
        })
        .select()
        .single();

      if (createError) throw createError;
      billRun = newBillRun;
    } else {
      billRun = existingBillRun;
    }
  }

  // Delete existing bill_lines (skip in preview mode)
  if (!previewMode) {
    await supabase
      .from("bill_line")
      .delete()
      .eq("bill_run_id", billRun.bill_run_id);
  }

  // Get active tenant users for this property
  // First get users from user_property, then check if they are active based on stay_record
  const { data: userProperties, error: userPropsError } = await supabase
    .from("user_property")
    .select(
      `
      user_id,
      app_user!inner(*)
    `
    )
    .eq("property_id", property_id);

  if (userPropsError) throw userPropsError;

  // Get stay records for these users to check if they are active
  const userIds = userProperties.map((up) => up.user_id);
  console.log("=== DEBUG: stay_record query ===");
  console.log("User IDs:", userIds);
  console.log("Property ID:", property_id);

  const { data: stayRecords, error: stayError } = await supabase
    .from("stay_record")
    .select("*")
    .in("user_id", userIds)
    .eq("property_id", property_id);

  if (stayError) throw stayError;

  console.log("Stay Records found:", stayRecords.length);
  stayRecords.forEach((record) => {
    console.log(
      `User ${record.user_id}: start_date=${record.start_date}, end_date=${record.end_date}`
    );
  });

  // Filter for active tenants based on stay_record dates
  const now = new Date();
  console.log("=== DEBUG: Active user filtering ===");
  console.log("Current time:", now.toISOString());
  console.log("Billing month start:", ms.toISOString());
  console.log("Billing month end:", monthEnd.toISOString());

  const propertyUsers = userProperties
    .map((up) => up.app_user)
    .filter((user) => {
      const isTenant = user.user_type === "tenant";
      const stayRecord = stayRecords.find((sr) => sr.user_id === user.user_id);

      // Check if user was active during the billing month
      const isActive =
        stayRecord &&
        // User started before or during the billing month
        new Date(stayRecord.start_date) <= monthEnd &&
        // User ended after or during the billing month (or is still active)
        (!stayRecord.end_date || new Date(stayRecord.end_date) >= ms);

      console.log(
        `User ${
          user.user_id
        }: isTenant=${isTenant}, hasStayRecord=${!!stayRecord}, isActive=${isActive}`
      );
      if (stayRecord) {
        console.log(
          `  start_date: ${stayRecord.start_date}, end_date: ${stayRecord.end_date}`
        );
        console.log(
          `  start_date <= monthEnd: ${
            new Date(stayRecord.start_date) <= monthEnd
          }`
        );
        console.log(
          `  end_date >= monthStart: ${
            !stayRecord.end_date || new Date(stayRecord.end_date) >= ms
          }`
        );
      }

      return isTenant && isActive;
    });

  console.log("Active users found:", propertyUsers.length);

  // Calculate days present for each user
  const userDays = {};
  const daysInMonth = monthEnd.getDate();

  // Calculate days present for each user based on stay_record and break_record
  for (const user of propertyUsers) {
    const stayRecord = stayRecords.find((sr) => sr.user_id === user.user_id);
    if (!stayRecord) {
      userDays[user.user_id] = 0;
      continue;
    }

    // Calculate actual stay period for this month
    const entryDate = new Date(stayRecord.start_date); // 入居日
    let exitDate;

    // If end_date is null or invalid, set it to the last day of the billing month
    if (
      !stayRecord.end_date ||
      isNaN(new Date(stayRecord.end_date).getTime())
    ) {
      // Set to the last day of the billing month for ongoing stays
      exitDate = new Date(monthEnd);
    } else {
      exitDate = new Date(stayRecord.end_date);
    }

    // Calculate overlap with the billing month
    const actualStart = new Date(Math.max(entryDate, ms));
    const actualEnd = new Date(Math.min(exitDate, monthEnd));

    // Basic days present in this month
    let daysPresent = Math.max(
      0,
      Math.ceil((actualEnd - actualStart) / (1000 * 60 * 60 * 24)) + 1
    );

    // Get break records for this user
    const { data: userBreakRecords, error: breakError } = await supabase
      .from("break_record")
      .select("*")
      .eq("stay_id", stayRecord.stay_id);

    if (breakError) {
      console.error("Error fetching break records:", breakError);
      userDays[user.user_id] = daysPresent;
      continue;
    }

    // Calculate total break days in this month
    let totalBreakDays = 0;

    // First, collect all break periods that overlap with the billing month
    const breakPeriods = [];
    userBreakRecords.forEach((breakRecord) => {
      const breakStart = new Date(breakRecord.break_start);
      const breakEnd = new Date(breakRecord.break_end);

      // Calculate overlap between break period, billing month, and stay period
      const breakOverlapStart = new Date(Math.max(breakStart, ms, actualStart));
      const breakOverlapEnd = new Date(Math.min(breakEnd, monthEnd, actualEnd));

      if (breakOverlapStart <= breakOverlapEnd) {
        breakPeriods.push({
          start: breakOverlapStart,
          end: breakOverlapEnd,
        });
      }
    });

    // Merge overlapping break periods to avoid double counting
    if (breakPeriods.length > 0) {
      // Sort by start date
      breakPeriods.sort((a, b) => a.start - b.start);

      // Merge overlapping periods
      const mergedPeriods = [breakPeriods[0]];
      for (let i = 1; i < breakPeriods.length; i++) {
        const current = breakPeriods[i];
        const last = mergedPeriods[mergedPeriods.length - 1];

        if (current.start <= last.end) {
          // Overlapping periods - merge them
          last.end = new Date(Math.max(last.end, current.end));
        } else {
          // Non-overlapping periods - add as new period
          mergedPeriods.push(current);
        }
      }

      // Calculate total break days from merged periods
      mergedPeriods.forEach((period) => {
        const breakDays =
          Math.ceil((period.end - period.start) / (1000 * 60 * 60 * 24)) + 1;
        totalBreakDays += breakDays;
      });
    }

    // Subtract break days from total days
    daysPresent = Math.max(0, daysPresent - totalBreakDays);
    userDays[user.user_id] = daysPresent;

    console.log(`=== DEBUG: User ${user.user_id} ===`);
    console.log(`Entry Date: ${entryDate.toISOString().split("T")[0]}`);
    console.log(`Exit Date: ${exitDate.toISOString().split("T")[0]}`);
    console.log(`Month Start: ${ms.toISOString().split("T")[0]}`);
    console.log(`Month End: ${monthEnd.toISOString().split("T")[0]}`);
    console.log(`Actual Start: ${actualStart.toISOString().split("T")[0]}`);
    console.log(`Actual End: ${actualEnd.toISOString().split("T")[0]}`);
    console.log(
      `Basic days present: ${
        Math.ceil((actualEnd - actualStart) / (1000 * 60 * 60 * 24)) + 1
      }`
    );
    console.log(`Total break days: ${totalBreakDays}`);
    console.log(`Final days present: ${daysPresent}`);
  }

  const headcount = Object.keys(userDays).length;
  const totalPersonDays = Object.values(userDays).reduce(
    (sum, days) => sum + days,
    0
  );

  // Calculate rent days for each user (without break periods)
  console.log("=== DEBUG: Calculating rent days (without break periods) ===");
  console.log("propertyUsers count:", propertyUsers.length);
  propertyUsers.forEach((user) => {
    console.log(`propertyUser: ${user.user_id}, name: ${user.name}`);
  });

  const rentDays = {};

  for (const user of propertyUsers) {
    console.log(
      `\n--- Processing user ${user.user_id} for rent calculation ---`
    );
    const stayRecord = stayRecords.find((sr) => sr.user_id === user.user_id);
    if (!stayRecord) {
      console.log(`No stay record found for user ${user.user_id}`);
      rentDays[user.user_id] = 0;
      continue;
    }

    console.log(
      `Stay record found: start_date=${stayRecord.start_date}, end_date=${stayRecord.end_date}`
    );

    // Calculate actual stay period for this month (same as current logic)
    const entryDate = new Date(stayRecord.start_date);
    let exitDate;

    console.log(`Entry date: ${entryDate.toISOString()}`);
    console.log(`Month start (ms): ${ms.toISOString()}`);
    console.log(`Month end: ${monthEnd.toISOString()}`);

    if (
      !stayRecord.end_date ||
      isNaN(new Date(stayRecord.end_date).getTime())
    ) {
      exitDate = new Date(monthEnd);
      console.log(`No end date, using month end: ${exitDate.toISOString()}`);
    } else {
      exitDate = new Date(stayRecord.end_date);
      console.log(`Exit date: ${exitDate.toISOString()}`);
    }

    // Calculate overlap with the billing month
    const actualStart = new Date(Math.max(entryDate, ms));
    const actualEnd = new Date(Math.min(exitDate, monthEnd));

    console.log(`Actual start: ${actualStart.toISOString()}`);
    console.log(`Actual end: ${actualEnd.toISOString()}`);

    // Calculate days present WITHOUT subtracting break days
    const daysPresent = Math.max(
      0,
      Math.ceil((actualEnd - actualStart) / (1000 * 60 * 60 * 24)) + 1
    );

    console.log(
      `Days calculation: (${actualEnd.getTime()} - ${actualStart.getTime()}) / (1000 * 60 * 60 * 24) + 1 = ${daysPresent}`
    );

    rentDays[user.user_id] = daysPresent;

    console.log(
      `Rent days for user ${user.user_id}: ${daysPresent} (break periods NOT subtracted)`
    );
  }

  // Get division rules
  console.log("=== DEBUG: Getting division rules ===");
  const { data: divisionRules, error: rulesError } = await supabase
    .from("division_rule_default")
    .select("*")
    .eq("property_id", property_id);

  if (rulesError) throw rulesError;
  console.log("Division rules found:", divisionRules.length);

  const rulesMap = {};
  divisionRules.forEach((rule) => {
    rulesMap[rule.utility] = rule.method;
  });

  // Get utility actuals
  console.log("=== DEBUG: Getting utility actuals ===");
  const { data: utilityActuals, error: actualsError } = await supabase
    .from("utility_actual")
    .select("*")
    .eq("property_id", property_id)
    .eq("month_start", month_start);

  if (actualsError) throw actualsError;
  console.log("Utility actuals found:", utilityActuals.length);

  // Get tenant rents
  console.log("=== DEBUG: Getting tenant rents ===");
  const { data: tenantRents, error: rentsError } = await supabase
    .from("tenant_rent")
    .select("*")
    .eq("property_id", property_id);

  if (rentsError) throw rentsError;
  console.log("Tenant rents found:", tenantRents.length);

  const billLines = [];
  let totalRent = 0;
  let totalUtilities = 0;

  // Process rent - proportional to stay days (without break periods)
  console.log("=== DEBUG: Processing rent with new proportional logic ===");
  console.log("rentDays object:", rentDays);
  console.log("tenantRents count:", tenantRents.length);

  tenantRents.forEach((rent) => {
    console.log(`\n--- Processing rent for user ${rent.user_id} ---`);
    console.log(`Monthly rent: ${rent.monthly_rent}`);
    console.log(`rentDays[${rent.user_id}]: ${rentDays[rent.user_id]}`);

    if (rentDays[rent.user_id] && rentDays[rent.user_id] > 0) {
      // 正しい月の日数計算 - UTCで統一
      const year = ms.getUTCFullYear();
      const month = ms.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      console.log(
        `Year: ${year}, Month: ${month} (0-based), Days in month: ${daysInMonth}`
      );
      console.log(
        `ms.getMonth() = ${ms.getMonth()}, should be 10 for November`
      );
      const stayDays = rentDays[rent.user_id];

      console.log(`Days in month: ${daysInMonth}`);
      console.log(`Stay days: ${stayDays}`);

      // Calculate rent - full amount if staying full month, proportional otherwise
      let proportionalRent;
      if (stayDays === daysInMonth) {
        // Full month - use full rent amount
        proportionalRent = rent.monthly_rent;
        console.log(`Full month stay - using full rent: ${proportionalRent}`);
      } else {
        // Partial month - calculate proportional rent
        proportionalRent =
          Math.round((rent.monthly_rent / daysInMonth) * stayDays * 100) / 100;
        console.log(
          `Partial month - calculation: (${rent.monthly_rent} / ${daysInMonth}) * ${stayDays} = ${proportionalRent}`
        );
      }

      console.log(
        `User ${rent.user_id}: monthly_rent=${rent.monthly_rent}, days_in_month=${daysInMonth}, stay_days=${stayDays}, proportional_rent=${proportionalRent}`
      );

      billLines.push({
        bill_run_id: billRun.bill_run_id,
        user_id: rent.user_id,
        utility: "rent",
        amount: proportionalRent,
        detail_json: {
          method: "bydays",
          monthly_rent: rent.monthly_rent,
          days_in_month: daysInMonth,
          stay_days: stayDays,
          proportional_amount: proportionalRent,
        },
      });

      totalRent += proportionalRent;
      console.log(`Added to billLines: ${proportionalRent}`);
    } else {
      console.log(
        `Skipping rent for user ${rent.user_id} - no stay days or rentDays is 0`
      );
    }
  });

  // Process utilities
  utilityActuals.forEach((actual) => {
    const method = rulesMap[actual.utility] || "equalshare";
    const amount = actual.amount;

    if (headcount === 0) {
      // No residents - assign to house account
      billLines.push({
        bill_run_id: billRun.bill_run_id,
        user_id: null,
        utility: actual.utility,
        amount: amount,
        detail_json: { method, reason: "no_residents" },
      });
    } else if (method === "fixed") {
      // Fixed - assign fixed amount to each user
      Object.keys(userDays).forEach((userId) => {
        billLines.push({
          bill_run_id: billRun.bill_run_id,
          user_id: userId,
          utility: actual.utility,
          amount: amount,
          detail_json: { method },
        });
      });
    } else if (method === "equalshare") {
      // Equal share - divide equally among active tenants
      const perPerson = Math.round((amount / headcount) * 100) / 100;

      Object.keys(userDays).forEach((userId) => {
        billLines.push({
          bill_run_id: billRun.bill_run_id,
          user_id: userId,
          utility: actual.utility,
          amount: perPerson,
          detail_json: { method, headcount },
        });
      });
    } else if (method === "bydays") {
      // By days - divide proportionally by stay days
      if (totalPersonDays === 0) {
        // No days - assign to house account
        billLines.push({
          bill_run_id: billRun.bill_run_id,
          user_id: null,
          utility: actual.utility,
          amount: amount,
          detail_json: { method, reason: "no_days" },
        });
      } else {
        Object.entries(userDays).forEach(([userId, days]) => {
          const userAmount =
            Math.round(((amount * days) / totalPersonDays) * 100) / 100;

          billLines.push({
            bill_run_id: billRun.bill_run_id,
            user_id: userId,
            utility: actual.utility,
            amount: userAmount,
            detail_json: {
              method,
              days_present: days,
              total_person_days: totalPersonDays,
            },
          });
        });
      }
    }

    totalUtilities += amount;
  });

  // Debug: Check billLines array
  console.log("=== DEBUG: billLines array ===");
  console.log("billLines.length:", billLines.length);
  console.log("billLines content:", billLines);

  // Insert bill lines (skip in preview mode)
  if (!previewMode && billLines.length > 0) {
    const { error: insertError } = await supabase
      .from("bill_line")
      .insert(billLines);

    if (insertError) throw insertError;
  }

  // Create ledger records for each user×property combination
  console.log("=== DEBUG: Creating ledger records ===");

  // Group bill lines by user_id and bill_run_id to calculate total amount per user
  const userTotals = {};
  billLines.forEach((line) => {
    if (line.user_id) {
      // Only process lines with actual users (not null)
      const key = `${line.user_id}_${line.bill_run_id}`;
      if (!userTotals[key]) {
        userTotals[key] = {
          user_id: line.user_id,
          bill_run_id: line.bill_run_id,
          total: 0,
        };
      }
      userTotals[key].total += line.amount;
    }
  });

  console.log("User totals:", userTotals);

  // Create ledger records for each user
  const ledgerRecords = [];
  for (const [key, userTotal] of Object.entries(userTotals)) {
    const { user_id, bill_run_id, total } = userTotal;

    // Get current balance for this user×property
    const { data: currentLedger, error: ledgerError } = await supabase
      .from("ledger")
      .select("amount")
      .eq("user_id", user_id)
      .eq("property_id", property_id)
      .order("posted_at", { ascending: false })
      .limit(1);

    if (ledgerError) {
      console.error("Error fetching current ledger:", ledgerError);
      continue;
    }

    // Calculate current balance (0 if no previous records)
    const currentBalance =
      currentLedger && currentLedger.length > 0 ? currentLedger[0].amount : 0;

    // Calculate new cumulative balance
    const newBalance = currentBalance + total; // Positive because it's a bill

    console.log(
      `User ${user_id}: current=${currentBalance}, bill=${total}, new=${newBalance}`
    );

    // Create ledger record
    ledgerRecords.push({
      user_id: user_id,
      property_id: parseInt(property_id),
      source_type: "bill",
      source_id: bill_run_id,
      amount: newBalance,
      posted_at: new Date().toISOString(),
    });
  }

  // Insert ledger records (skip in preview mode)
  if (!previewMode && ledgerRecords.length > 0) {
    const { error: ledgerInsertError } = await supabase
      .from("ledger")
      .insert(ledgerRecords);

    if (ledgerInsertError) {
      console.error("Error inserting ledger records:", ledgerInsertError);
      throw ledgerInsertError;
    }

    console.log(`Created ${ledgerRecords.length} ledger records`);
  }

  const result = {
    bill_run_id: billRun.bill_run_id,
    lines_created: billLines.length,
    ledger_records_created: ledgerRecords.length,
    totals: {
      rent: totalRent,
      utilities: totalUtilities,
      grand_total: totalRent + totalUtilities,
    },
    user_days: userDays,
    headcount: headcount,
    total_person_days: totalPersonDays,
  };

  // Include preview data if in preview mode
  if (previewMode) {
    result.previewData = {
      billLines: billLines,
      ledgerRecords: ledgerRecords,
    };
  }

  return result;
}

// Write preview data to database
async function writePreviewDataToDatabase(
  property_id,
  month_start,
  previewData
) {
  console.log(`=== DEBUG: writePreviewDataToDatabase ===`);
  console.log(`Property ID: ${property_id}`);
  console.log(`Month Start: ${month_start}`);
  console.log(`Preview Data:`, previewData);

  // Get or create bill_run
  let { data: billRun, error: billRunError } = await supabase
    .from("bill_run")
    .select("*")
    .eq("property_id", property_id)
    .eq("month_start", month_start)
    .single();

  if (billRunError && billRunError.code !== "PGRST116") {
    throw billRunError;
  }

  if (!billRun) {
    const { data: newBillRun, error: createError } = await supabase
      .from("bill_run")
      .insert({
        property_id,
        month_start,
        status: "open",
      })
      .select()
      .single();

    if (createError) throw createError;
    billRun = newBillRun;
  }

  // Delete existing bill_lines
  await supabase
    .from("bill_line")
    .delete()
    .eq("bill_run_id", billRun.bill_run_id);

  // Insert bill lines from preview data
  if (previewData.billLines && previewData.billLines.length > 0) {
    // Update bill_run_id in bill lines to use the actual bill_run_id
    const billLinesWithCorrectId = previewData.billLines.map((line) => ({
      ...line,
      bill_run_id: billRun.bill_run_id,
    }));

    const { error: insertError } = await supabase
      .from("bill_line")
      .insert(billLinesWithCorrectId);

    if (insertError) throw insertError;
  }

  // Insert ledger records from preview data
  if (previewData.ledgerRecords && previewData.ledgerRecords.length > 0) {
    // Update source_id in ledger records to use the actual bill_run_id
    const ledgerRecordsWithCorrectId = previewData.ledgerRecords.map(
      (record) => ({
        ...record,
        source_id: billRun.bill_run_id, // Update source_id to match actual bill_run_id
      })
    );

    const { error: ledgerInsertError } = await supabase
      .from("ledger")
      .insert(ledgerRecordsWithCorrectId);

    if (ledgerInsertError) {
      console.error("Error inserting ledger records:", ledgerInsertError);
      throw ledgerInsertError;
    }
  }

  return {
    bill_run_id: billRun.bill_run_id,
    lines_created: previewData.billLines ? previewData.billLines.length : 0,
    ledger_records_created: previewData.ledgerRecords
      ? previewData.ledgerRecords.length
      : 0,
    totals: {
      rent:
        previewData.billLines
          ?.filter((line) => line.utility === "rent")
          .reduce((sum, line) => sum + line.amount, 0) || 0,
      utilities:
        previewData.billLines
          ?.filter((line) => line.utility !== "rent")
          .reduce((sum, line) => sum + line.amount, 0) || 0,
      grand_total:
        previewData.billLines?.reduce((sum, line) => sum + line.amount, 0) || 0,
    },
    user_days: {}, // Not available in preview data
    headcount: 0, // Not available in preview data
    total_person_days: 0, // Not available in preview data
  };
}

// Create tenant endpoint
app.post("/create-tenant", async (req, res) => {
  try {
    const { name, email, user_type, property_id } = req.body;

    console.log("=== DEBUG: create-tenant ===");
    console.log("Request body:", { name, email, user_type, property_id });
    console.log("property_id type:", typeof property_id);

    // バリデーション
    if (!name || !email || !user_type || !property_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // 既存ユーザーのチェック（emailで検索）
    const { data: existingUser, error: userError } = await supabase
      .from("app_user")
      .select("user_id")
      .eq("email", email)
      .single();

    if (userError && userError.code !== "PGRST116") {
      throw userError;
    }

    let userId;

    if (existingUser) {
      // 既存ユーザーの場合
      userId = existingUser.user_id;
      console.log("Existing user found, userId:", userId);

      // 既に同じpropertyに所属しているかチェック
      const { data: existingUserProperty, error: upError } = await supabase
        .from("user_property")
        .select("user_property_id")
        .eq("user_id", userId)
        .eq("property_id", property_id)
        .single();

      if (upError && upError.code !== "PGRST116") {
        throw upError;
      }

      if (existingUserProperty) {
        return res.status(400).json({
          success: false,
          error: "User already belongs to this property",
        });
      }

      // user_propertyにレコード追加
      console.log("Inserting into user_property:", {
        user_id: userId,
        property_id: parseInt(property_id),
      });
      const { error: upInsertError } = await supabase
        .from("user_property")
        .insert({
          user_id: userId,
          property_id: parseInt(property_id),
        });

      if (upInsertError) {
        console.error("user_property insert error:", upInsertError);
        throw upInsertError;
      }
    } else {
      // 新規ユーザーの場合
      console.log("Creating new user:", { name, email, user_type });
      const { data: newUser, error: newUserError } = await supabase
        .from("app_user")
        .insert({
          name,
          email,
          user_type,
          personal_multiplier: 1.0,
        })
        .select("user_id")
        .single();

      if (newUserError) {
        console.error("app_user insert error:", newUserError);
        throw newUserError;
      }
      userId = newUser.user_id;
      console.log("New user created, userId:", userId);

      // user_propertyにレコード追加
      console.log("Inserting into user_property:", {
        user_id: userId,
        property_id: parseInt(property_id),
      });
      const { error: upInsertError } = await supabase
        .from("user_property")
        .insert({
          user_id: userId,
          property_id: parseInt(property_id),
        });

      if (upInsertError) {
        console.error("user_property insert error:", upInsertError);
        throw upInsertError;
      }
    }

    // ledgerにレコード追加（初期化）
    const sourceId = Math.floor(Math.random() * 1000000000); // int8型
    console.log("Inserting into ledger:", {
      user_id: userId,
      property_id: parseInt(property_id),
      source_type: "adjustment",
      source_id: sourceId,
      amount: 0,
    });
    const { error: ledgerError } = await supabase.from("ledger").insert({
      user_id: userId, // UUID型
      property_id: parseInt(property_id), // bigint型
      source_type: "adjustment",
      source_id: sourceId, // int8型
      amount: 0,
    });

    if (ledgerError) {
      console.error("ledger insert error:", ledgerError);
      throw ledgerError;
    }

    console.log("Success: Tenant created/updated");

    res.json({
      success: true,
      message: existingUser
        ? "Property added to existing tenant"
        : "New tenant created successfully",
      user_id: userId,
    });
  } catch (error) {
    console.error("Error creating tenant:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create property endpoint
app.post("/create-property", async (req, res) => {
  try {
    const { name, timezone, owner_id, active = true } = req.body;

    console.log("=== DEBUG: create-property ===");
    console.log("Request body:", { name, timezone, owner_id, active });

    if (!name || !timezone || !owner_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // owner_idがownerタイプのユーザーかチェック
    const { data: ownerUser, error: ownerError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", owner_id)
      .single();

    if (ownerError) {
      throw ownerError;
    }

    if (ownerUser.user_type !== "owner") {
      return res.status(400).json({
        success: false,
        error: "Selected user is not an owner",
      });
    }

    // 重複チェック: 同じownerが同じ名前のプロパティを持っていないかチェック
    const { data: existingProperty, error: duplicateError } = await supabase
      .from("property")
      .select("property_id")
      .eq("name", name)
      .eq("owner_id", owner_id)
      .single();

    if (duplicateError && duplicateError.code !== "PGRST116") {
      throw duplicateError;
    }

    if (existingProperty) {
      return res.status(400).json({
        success: false,
        error: "Property with this name already exists for this owner",
      });
    }

    // propertyテーブルに挿入
    const { data: newProperty, error: propError } = await supabase
      .from("property")
      .insert({
        name,
        timezone,
        owner_id,
        active,
      })
      .select("property_id")
      .single();

    if (propError) {
      throw propError;
    }

    console.log("Success: Property created");
    res.json({
      success: true,
      message: "Property created successfully",
      property_id: newProperty.property_id,
    });
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create payment endpoint
app.post("/create-payment", async (req, res) => {
  try {
    const { user_id, property_id, amount, note } = req.body;

    console.log("=== DEBUG: create-payment ===");
    console.log("Request body:", { user_id, property_id, amount, note });

    if (!user_id || !property_id || !amount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be positive",
      });
    }

    // Check if user exists and is a tenant
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", user_id)
      .single();

    if (userError) {
      throw userError;
    }

    if (user.user_type !== "tenant") {
      return res.status(400).json({
        success: false,
        error: "Selected user is not a tenant",
      });
    }

    // Check if property exists
    const { data: property, error: propertyError } = await supabase
      .from("property")
      .select("property_id")
      .eq("property_id", property_id)
      .single();

    if (propertyError) {
      throw propertyError;
    }

    // Check if user belongs to this property
    const { data: userProperty, error: upError } = await supabase
      .from("user_property")
      .select("user_property_id")
      .eq("user_id", user_id)
      .eq("property_id", property_id)
      .single();

    if (upError) {
      return res.status(400).json({
        success: false,
        error: "User does not belong to this property",
      });
    }

    // Insert into payment table
    const { data: newPayment, error: paymentError } = await supabase
      .from("payment")
      .insert({
        user_id: user_id,
        property_id: parseInt(property_id),
        amount: parseFloat(amount),
        note: note || null,
        paid_at: new Date().toISOString(),
      })
      .select("payment_id")
      .single();

    if (paymentError) {
      console.error("payment insert error:", paymentError);
      throw paymentError;
    }

    console.log("Payment created, payment_id:", newPayment.payment_id);

    // Get current balance for this user×property
    const { data: currentLedger, error: ledgerError } = await supabase
      .from("ledger")
      .select("amount")
      .eq("user_id", user_id)
      .eq("property_id", property_id)
      .order("posted_at", { ascending: false })
      .limit(1);

    if (ledgerError) {
      console.error("Error fetching current ledger:", ledgerError);
      throw ledgerError;
    }

    // Calculate current balance (0 if no previous records)
    const currentBalance =
      currentLedger && currentLedger.length > 0 ? currentLedger[0].amount : 0;

    // Calculate new cumulative balance (positive because it's a payment)
    const newBalance = currentBalance + parseFloat(amount);

    console.log(
      `User ${user_id}: current=${currentBalance}, payment=${amount}, new=${newBalance}`
    );

    // Create ledger record
    const { error: ledgerInsertError } = await supabase.from("ledger").insert({
      user_id: user_id,
      property_id: parseInt(property_id),
      source_type: "payment",
      source_id: newPayment.payment_id,
      amount: newBalance,
      posted_at: new Date().toISOString(),
    });

    if (ledgerInsertError) {
      console.error("Error inserting ledger record:", ledgerInsertError);
      throw ledgerInsertError;
    }

    console.log("Success: Payment created and ledger updated");
    res.json({
      success: true,
      message: "Payment created successfully",
      payment_id: newPayment.payment_id,
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /select-user-type - ユーザータイプ選択
app.post("/select-user-type", async (req, res) => {
  try {
    const { user_type } = req.body;
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} selecting user type: ${user_type}`);

    // 1. 入力値検証
    if (!user_type || !["owner", "tenant"].includes(user_type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user type. Must be 'owner' or 'tenant'",
      });
    }

    // 2. 既にapp_userレコードが存在するかチェック
    const { data: existingUser, error: checkError } = await supabase
      .from("app_user")
      .select("user_id, user_type")
      .eq("user_id", userId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User type already selected",
      });
    }

    // 3. app_userテーブルにレコード作成
    const { data: newUser, error: createError } = await supabase
      .from("app_user")
      .insert({
        user_id: userId,
        name: req.user.user_metadata?.full_name || "Unknown",
        email: req.user.email,
        user_type: user_type,
        personal_multiplier: 1.0,
        phone_number: null,
      })
      .select("user_id, user_type")
      .single();

    if (createError) {
      console.error("Error creating app_user:", createError);
      throw createError;
    }

    console.log(`[SECURITY] User type selected successfully: ${user_type}`);

    res.json({
      success: true,
      user_id: newUser.user_id,
      user_type: newUser.user_type,
      message: "User type selected successfully",
    });
  } catch (error) {
    console.error("[SECURITY] Select user type error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to select user type",
    });
  }
});

// GET /tenant-properties - テナントのプロパティ一覧取得
app.get("/tenant-properties", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting tenant properties`);

    // 1. ユーザーがテナントかチェック
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    if (user.user_type !== "tenant") {
      console.log(`[SECURITY] Access denied for user ${userId}: not a tenant`);
      return res.status(403).json({
        success: false,
        error: "Tenant access required",
      });
    }

    // 2. テナントのプロパティ一覧を取得
    const { data: userProperties, error: propertiesError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          active,
          address
        )
      `
      )
      .eq("user_id", userId);

    if (propertiesError) {
      throw propertiesError;
    }

    // 3. アクティブなプロパティのみをフィルタリング
    const activeProperties = userProperties
      .map((up) => up.property)
      .filter((property) => property && property.active);

    console.log(
      `[SECURITY] Found ${activeProperties.length} properties for tenant ${userId}`
    );

    res.json({
      success: true,
      properties: activeProperties,
    });
  } catch (error) {
    console.error("[SECURITY] Tenant properties error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tenant properties",
    });
  }
});

// GET /tenant-bill-history - テナント用Bill History
app.get("/tenant-bill-history", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting tenant bill history`);

    // 1. ユーザータイプを取得
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    // 2. テナントかチェック
    if (user.user_type !== "tenant") {
      console.log(`[SECURITY] Access denied for user ${userId}: not a tenant`);
      return res.status(403).json({
        success: false,
        error: "Tenant access required",
      });
    }

    // 3. テナントのプロパティ一覧を取得
    const { data: userProperties, error: propertiesError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          active,
          address
        )
      `
      )
      .eq("user_id", userId);

    if (propertiesError) {
      throw propertiesError;
    }

    // 4. アクティブなプロパティのみをフィルタリング
    const activeProperties = userProperties
      .map((up) => up.property)
      .filter((property) => property && property.active);

    if (activeProperties.length === 0) {
      console.log(`[SECURITY] No active properties found for tenant ${userId}`);
      return res.json({
        success: true,
        properties: [],
        billLines: [],
      });
    }

    // 5. テナントのBill Lineデータを取得（全プロパティ対象）
    const { data: billLines, error: billLinesError } = await supabase
      .from("bill_line")
      .select(
        `
            bill_line_id,
            user_id,
            utility,
            amount,
            bill_run_id,
            bill_run:bill_run_id (
              month_start,
              property_id,
              property:property_id (
                name
              )
            )
          `
      )
      .eq("user_id", userId);

    if (billLinesError) {
      throw billLinesError;
    }

    console.log(
      `[SECURITY] Found ${billLines.length} bill lines for tenant ${userId}`
    );

    res.json({
      success: true,
      properties: activeProperties,
      billLines: billLines || [],
    });
  } catch (error) {
    console.error("[SECURITY] Tenant bill history error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tenant bill history",
    });
  }
});

// GET /tenant-payments - テナント用支払い履歴取得
app.get("/tenant-payments", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting tenant payments`);

    // 1. ユーザータイプ確認
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    if (user.user_type !== "tenant") {
      console.log(`[SECURITY] Access denied for user ${userId}: not a tenant`);
      return res.status(403).json({
        success: false,
        error: "Tenant access required",
      });
    }

    // 2. テナントの所属プロパティ取得
    const { data: userProperties, error: propertiesError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          active,
          address
        )
      `
      )
      .eq("user_id", userId);

    if (propertiesError) {
      throw propertiesError;
    }

    // アクティブなプロパティのみをフィルタリング
    const activeProperties = userProperties
      .filter((up) => up.property && up.property.active)
      .map((up) => ({
        property_id: up.property.property_id,
        property: up.property,
      }));

    // 3. テナントの支払い履歴取得
    const { data: payments, error: paymentsError } = await supabase
      .from("payment")
      .select(
        `
        payment_id,
        user_id,
        property_id,
        amount,
        note,
        paid_at,
        property:property_id (
          name
        )
      `
      )
      .eq("user_id", userId)
      .order("paid_at", { ascending: false });

    if (paymentsError) {
      throw paymentsError;
    }

    // 4. 各支払いの承認ステータス確認
    const paymentsWithStatus = await Promise.all(
      payments.map(async (payment) => {
        const { data: ledgerRecord, error: ledgerError } = await supabase
          .from("ledger")
          .select("ledger_id")
          .eq("user_id", payment.user_id)
          .eq("property_id", payment.property_id)
          .eq("source_type", "payment")
          .eq("source_id", payment.payment_id)
          .single();

        // エラーは無視（レコードが存在しない場合）
        return {
          ...payment,
          app_user: {
            ...payment.app_user,
          },
          isAccepted: !!ledgerRecord,
        };
      })
    );

    console.log(
      `[SECURITY] Found ${paymentsWithStatus.length} payments for tenant ${userId}`
    );

    res.json({
      success: true,
      payments: paymentsWithStatus || [],
      userProperties: activeProperties || [],
    });
  } catch (error) {
    console.error("[SECURITY] Tenant payments error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tenant payments",
    });
  }
});

// POST /create-tenant-payment - テナント用支払い作成
app.post("/create-tenant-payment", async (req, res) => {
  try {
    const userId = req.user.id;
    const { property_id, amount, note } = req.body;

    console.log(`[SECURITY] User ${userId} creating tenant payment`);
    console.log(`[SECURITY] Payment data:`, { property_id, amount, note });

    // 1. 入力値の検証
    if (!property_id || !amount) {
      return res.status(400).json({
        success: false,
        error: "Property ID and amount are required",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      });
    }

    // 2. ユーザータイプ確認
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    if (user.user_type !== "tenant") {
      console.log(`[SECURITY] Access denied for user ${userId}: not a tenant`);
      return res.status(403).json({
        success: false,
        error: "Tenant access required",
      });
    }

    // 3. プロパティアクセス権確認
    const { data: userProperty, error: propertyError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          active
        )
      `
      )
      .eq("user_id", userId)
      .eq("property_id", property_id)
      .single();

    if (propertyError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId}: no access to property ${property_id}`
      );
      return res.status(403).json({
        success: false,
        error: "No access to this property",
      });
    }

    if (!userProperty.property.active) {
      console.log(
        `[SECURITY] Access denied for user ${userId}: property ${property_id} is inactive`
      );
      return res.status(403).json({
        success: false,
        error: "Property is not active",
      });
    }

    // 4. 支払いレコード作成
    const { data: payment, error: paymentError } = await supabase
      .from("payment")
      .insert({
        user_id: userId,
        property_id: property_id,
        amount: amount,
        note: note || null,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    console.log(`[SECURITY] Payment created successfully:`, payment);

    res.json({
      success: true,
      payment: payment,
      message: "Payment created successfully",
    });
  } catch (error) {
    console.error("[SECURITY] Create tenant payment error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create payment",
    });
  }
});

// GET /tenant-running-balance - テナント用残高履歴取得
app.get("/tenant-running-balance", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting tenant running balance`);

    // 1. ユーザータイプ確認
    const { data: user, error: userError } = await supabase
      .from("app_user")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    if (user.user_type !== "tenant") {
      console.log(`[SECURITY] Access denied for user ${userId}: not a tenant`);
      return res.status(403).json({
        success: false,
        error: "Tenant access required",
      });
    }

    // 2. テナントの所属プロパティ取得（フィルター用）
    const { data: userProperties, error: propertiesError } = await supabase
      .from("user_property")
      .select(
        `
        property_id,
        property:property_id (
          property_id,
          name,
          active,
          address
        )
      `
      )
      .eq("user_id", userId);

    if (propertiesError) {
      throw propertiesError;
    }

    // アクティブなプロパティのみをフィルタリング
    const activeProperties = userProperties
      .filter((up) => up.property && up.property.active)
      .map((up) => ({
        property_id: up.property.property_id,
        property: up.property,
      }));

    // 3. ledgerテーブルからテナントの全レコード取得
    const { data: ledgerRecords, error: ledgerError } = await supabase
      .from("ledger")
      .select(
        `
        ledger_id,
        user_id,
        property_id,
        amount,
        posted_at,
        source_type,
        source_id,
        property:property_id (
          name
        )
      `
      )
      .eq("user_id", userId)
      .order("posted_at", { ascending: true });

    if (ledgerError) {
      throw ledgerError;
    }

    // 4. 残高計算
    let runningBalance = 0;
    const recordsWithBalance = ledgerRecords.map((record) => {
      runningBalance += record.amount;
      return {
        ...record,
        running_balance: runningBalance,
      };
    });

    console.log(
      `[SECURITY] Found ${recordsWithBalance.length} ledger records for tenant ${userId}`
    );

    res.json({
      success: true,
      ledgerRecords: recordsWithBalance || [],
      userProperties: activeProperties || [],
    });
  } catch (error) {
    console.error("[SECURITY] Tenant running balance error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch running balance",
    });
  }
});

// GET /owner-tenant/:tenantId - ニックネーム取得
app.get("/owner-tenant/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const ownerId = req.user.id;

    console.log(
      `[SECURITY] User ${ownerId} requesting nickname for tenant ${tenantId}`
    );

    const { data: ownerTenant, error } = await supabase
      .from("owner_tenant")
      .select("nick_name")
      .eq("owner_id", ownerId)
      .eq("tenant_id", tenantId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching nickname:", error);
      throw error;
    }

    res.json({ nick_name: ownerTenant?.nick_name || null });
  } catch (error) {
    console.error("Nickname fetch error:", error);
    res.status(500).json({ error: "Failed to fetch nickname" });
  }
});

// POST /owner-tenant - ニックネーム保存/更新
app.post("/owner-tenant", async (req, res) => {
  try {
    const { tenant_id, nick_name } = req.body;
    const owner_id = req.user.id;

    console.log(
      `[SECURITY] User ${owner_id} saving nickname for tenant ${tenant_id}: ${nick_name}`
    );

    const { data, error } = await supabase
      .from("owner_tenant")
      .upsert(
        {
          owner_id,
          tenant_id,
          nick_name: nick_name || null,
        },
        {
          onConflict: "owner_id,tenant_id",
        }
      )
      .select("nick_name")
      .single();

    if (error) {
      console.error("Error saving nickname:", error);
      throw error;
    }

    res.json({ nick_name: data.nick_name });
  } catch (error) {
    console.error("Nickname save error:", error);
    res.status(500).json({ error: "Failed to save nickname" });
  }
});

// GET /bill-runs/:propertyId - プロパティの全てのbill_runを取得
app.get("/bill-runs/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(
      `[SECURITY] User ${userId} requesting bill runs for property ${propertyId}`
    );

    // アクセス権限チェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${propertyId}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // bill_runを全て取得
    const { data: billRuns, error } = await supabase
      .from("bill_run")
      .select("*")
      .eq("property_id", propertyId)
      .order("month_start", { ascending: false });

    if (error) {
      throw error;
    }

    console.log(
      `[SECURITY] Bill runs fetched for property ${propertyId}: ${
        billRuns?.length || 0
      } records`
    );

    res.json({
      billRuns: billRuns || [],
    });
  } catch (error) {
    console.error("Bill runs error:", error);
    res.status(500).json({ error: "Failed to fetch bill runs" });
  }
});

// GET /latest-bill-run-month/:propertyId - 最新のbill_run月を取得
app.get("/latest-bill-run-month/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    console.log(
      `[SECURITY] User ${userId} requesting latest bill run month for property ${propertyId}`
    );

    // アクセス権限チェック
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied for user ${userId} to property ${propertyId}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // 最新のmonth_startを取得
    const { data: latestBillRun, error } = await supabase
      .from("bill_run")
      .select("month_start")
      .eq("property_id", propertyId)
      .order("month_start", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    console.log(
      `[SECURITY] Latest bill run month for property ${propertyId}: ${
        latestBillRun?.month_start || "none"
      }`
    );

    res.json({
      latestMonth: latestBillRun?.month_start || null,
    });
  } catch (error) {
    console.error("Latest bill run month error:", error);
    res.status(500).json({ error: "Failed to fetch latest month" });
  }
});

// Break Period専用のAPIエンドポイント

// Break Period追加
app.post("/break-periods", async (req, res) => {
  try {
    const { property_id, user_id, break_start, break_end } = req.body;
    const userId = req.user.id; // ← ADD AUTHENTICATION

    console.log(
      `[SECURITY] User ${userId} adding break period for property ${property_id}`
    );

    // ← ADD AUTHORIZATION CHECK
    const { data: userProperty, error: accessError } = await supabase
      .from("user_property")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", property_id)
      .single();

    if (accessError || !userProperty) {
      console.log(
        `[SECURITY] Access denied to property ${property_id} for user ${userId}`
      );
      return res.status(403).json({ error: "Access denied to this property" });
    }

    // stay_recordから該当のstay_idを取得
    const { data: stayRecord, error: stayError } = await supabase
      .from("stay_record")
      .select("stay_id")
      .eq("user_id", user_id)
      .eq("property_id", property_id)
      .single();

    if (stayError || !stayRecord) {
      console.log(
        `[SECURITY] No stay record found for user ${user_id} in property ${property_id}`
      );
      return res.status(404).json({
        error:
          "No stay record found for this tenant. Please set stay periods first.",
      });
    }

    // break_recordに新規レコードを追加
    const { data: newBreakRecord, error: insertError } = await supabase
      .from("break_record")
      .insert({
        stay_id: stayRecord.stay_id,
        break_start: break_start,
        break_end: break_end,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting break record:", insertError);
      return res.status(500).json({ error: "Failed to add break period" });
    }

    console.log(
      `[SECURITY] Break period added successfully for property ${property_id}`
    );

    res.json({
      success: true,
      break_record: newBreakRecord,
    });
  } catch (error) {
    console.error("Break period addition error:", error);
    res.status(500).json({ error: "Failed to add break period" });
  }
});

// Break Period削除
app.delete("/break-periods/:break_record_id", async (req, res) => {
  try {
    const { break_record_id } = req.params;
    const userId = req.user.id; // ← ADD AUTHENTICATION

    console.log(
      `[SECURITY] User ${userId} deleting break period ${break_record_id}`
    );

    // break_recordから該当レコードを取得（stay_idも含めて）
    const { data: breakRecord, error: breakError } = await supabase
      .from("break_record")
      .select(
        `
        break_record_id,
        stay_id,
        stay_record!inner(
          property_id,
          user_property!inner(user_id)
        )
      `
      )
      .eq("break_record_id", break_record_id)
      .single();

    if (breakError || !breakRecord) {
      console.log(`[SECURITY] Break record ${break_record_id} not found`);
      return res.status(404).json({ error: "Break period not found" });
    }

    // プロパティのオーナー権限チェック
    if (breakRecord.stay_record.user_property.user_id !== userId) {
      console.log(
        `[SECURITY] Access denied to break record ${break_record_id}`
      );
      return res
        .status(403)
        .json({ error: "Access denied to this break period" });
    }

    // break_recordを削除
    const { error: deleteError } = await supabase
      .from("break_record")
      .delete()
      .eq("break_record_id", break_record_id);

    if (deleteError) {
      console.error("Error deleting break record:", deleteError);
      return res.status(500).json({ error: "Failed to delete break period" });
    }

    console.log(
      `[SECURITY] Break period ${break_record_id} deleted successfully`
    );

    res.json({
      success: true,
      message: "Break period deleted successfully",
    });
  } catch (error) {
    console.error("Break period deletion error:", error);
    res.status(500).json({ error: "Failed to delete break period" });
  }
});

// ==========================================
// LOAN ENDPOINTS
// ==========================================

// GET /loans - Get all loans for the current owner
app.get("/loans", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting loans`);

    // Get all loans where this user is the owner
    const { data: loans, error } = await supabase
      .from("loan")
      .select(
        `
        loan_id,
        owner_user_id,
        tenant_user_id,
        amount,
        status,
        note,
        created_date,
        paid_date,
        confirmed_date,
        tenant:tenant_user_id (
          user_id,
          name,
          email
        )
        `
      )
      .eq("owner_user_id", userId)
      .order("created_date", { ascending: false });

    if (error) throw error;

    console.log(
      `[SECURITY] Found ${loans?.length || 0} loans for owner ${userId}`
    );

    res.json({ loans: loans || [] });
  } catch (error) {
    console.error("Get loans error:", error);
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

// POST /loans - Create a new loan
app.post("/loans", async (req, res) => {
  try {
    const userId = req.user.id;
    const { tenant_user_id, amount, note } = req.body;

    console.log(
      `[SECURITY] User ${userId} creating loan for tenant ${tenant_user_id}`
    );

    if (!tenant_user_id || !amount) {
      return res
        .status(400)
        .json({ error: "tenant_user_id and amount are required" });
    }

    // Create new loan
    const { data: newLoan, error } = await supabase
      .from("loan")
      .insert({
        owner_user_id: userId,
        tenant_user_id: tenant_user_id,
        amount: amount,
        status: "pending",
        note: note || null,
        created_date: new Date().toISOString(),
      })
      .select(
        `
        loan_id,
        owner_user_id,
        tenant_user_id,
        amount,
        status,
        note,
        created_date,
        tenant:tenant_user_id (
          user_id,
          name,
          email
        )
        `
      )
      .single();

    if (error) throw error;

    console.log(`[SECURITY] Loan created successfully: ${newLoan.loan_id}`);

    res.json({ loan: newLoan });
  } catch (error) {
    console.error("Create loan error:", error);
    res.status(500).json({ error: "Failed to create loan" });
  }
});

// PUT /loans/:loanId/paid - Mark loan as paid (by tenant)
app.put("/loans/:loanId/paid", async (req, res) => {
  try {
    const userId = req.user.id;
    const { loanId } = req.params;

    console.log(`[SECURITY] User ${userId} marking loan ${loanId} as paid`);

    // Update loan status to paid
    const { data: updatedLoan, error } = await supabase
      .from("loan")
      .update({
        status: "paid",
        paid_date: new Date().toISOString(),
      })
      .eq("loan_id", loanId)
      .eq("tenant_user_id", userId)
      .select()
      .single();

    if (error) throw error;

    if (!updatedLoan) {
      return res.status(404).json({ error: "Loan not found or unauthorized" });
    }

    console.log(`[SECURITY] Loan ${loanId} marked as paid`);

    res.json({ loan: updatedLoan });
  } catch (error) {
    console.error("Update loan paid error:", error);
    res.status(500).json({ error: "Failed to update loan status" });
  }
});

// PUT /loans/:loanId/confirm - Mark loan as confirmed (by owner)
app.put("/loans/:loanId/confirm", async (req, res) => {
  try {
    const userId = req.user.id;
    const { loanId } = req.params;

    console.log(`[SECURITY] User ${userId} confirming loan ${loanId}`);

    // Update loan status to confirmed
    const { data: updatedLoan, error } = await supabase
      .from("loan")
      .update({
        status: "confirmed",
        confirmed_date: new Date().toISOString(),
      })
      .eq("loan_id", loanId)
      .eq("owner_user_id", userId)
      .select()
      .single();

    if (error) throw error;

    if (!updatedLoan) {
      return res.status(404).json({ error: "Loan not found or unauthorized" });
    }

    console.log(`[SECURITY] Loan ${loanId} confirmed by owner`);

    res.json({ loan: updatedLoan });
  } catch (error) {
    console.error("Confirm loan error:", error);
    res.status(500).json({ error: "Failed to confirm loan" });
  }
});

// GET /tenant/loans - Get all loans for the current tenant
app.get("/tenant/loans", async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[SECURITY] User ${userId} requesting tenant loans`);

    // Get all loans where this user is the tenant
    const { data: loans, error } = await supabase
      .from("loan")
      .select(
        `
        loan_id,
        owner_user_id,
        tenant_user_id,
        amount,
        status,
        note,
        created_date,
        paid_date,
        confirmed_date,
        owner:owner_user_id (
          user_id,
          name,
          email
        )
        `
      )
      .eq("tenant_user_id", userId)
      .order("created_date", { ascending: false });

    if (error) throw error;

    console.log(
      `[SECURITY] Found ${loans?.length || 0} loans for tenant ${userId}`
    );

    res.json({ loans: loans || [] });
  } catch (error) {
    console.error("Get tenant loans error:", error);
    res.status(500).json({ error: "Failed to fetch tenant loans" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
