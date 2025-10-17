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
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
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
    if (property_id && month_start) {
      // Verify user has access to this property
      const hasAccess = properties.some((p) => p.property_id == property_id);
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

    res.json({
      properties,
      divisionRules,
      utilityActuals,
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

// POST /save-stay-periods - 滞在期間保存
app.post("/save-stay-periods", async (req, res) => {
  try {
    const { property_id, stay_periods, break_periods } = req.body;

    if (!property_id || !stay_periods) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Delete existing stay records for this property
    await supabase.from("stay_record").delete().eq("property_id", property_id);

    // Delete existing break records for this property
    // First get stay_ids for this property, then delete break_records
    const { data: existingStayRecords } = await supabase
      .from("stay_record")
      .select("stay_id")
      .eq("property_id", property_id);

    if (existingStayRecords && existingStayRecords.length > 0) {
      const stayIds = existingStayRecords.map((sr) => sr.stay_id);
      await supabase.from("break_record").delete().in("stay_id", stayIds);
    }

    // Insert new stay records
    const stayRecords = Object.entries(stay_periods).map(
      ([user_id, period]) => ({
        user_id,
        property_id: parseInt(property_id),
        start_date: period.startDate,
        end_date: period.endDate,
      })
    );

    if (stayRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("stay_record")
        .insert(stayRecords);

      if (insertError) throw insertError;
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
            breakRecords.push({
              stay_id,
              break_start: breakPeriod.breakStart,
              break_end: breakPeriod.breakEnd,
            });
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

    res.json({
      ok: true,
      stay_records_saved: stayRecords.length,
      break_records_saved: break_periods
        ? Object.values(break_periods).flat().length
        : 0,
    });
  } catch (error) {
    console.error("Save stay periods error:", error);
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

// POST /run-bill - 請求計算実行
app.post("/run-bill", async (req, res) => {
  try {
    const { property_id, month_start, stay_periods } = req.body;

    if (!property_id || !month_start) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Calculate bills
    const result = await calculateBills(property_id, month_start, stay_periods);

    res.json(result);
  } catch (error) {
    console.error("Run bill error:", error);
    res.status(500).json({ error: "Failed to run bill calculation" });
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
  manualStayPeriods = {}
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

  // Process rent
  tenantRents.forEach((rent) => {
    // Fixed method - assign full monthly rent to each user
    billLines.push({
      bill_run_id: billRun.bill_run_id,
      user_id: rent.user_id,
      utility: "rent",
      amount: rent.monthly_rent,
      detail_json: {
        method: "fixed",
        monthly_rent: rent.monthly_rent,
      },
    });

    totalRent += rent.monthly_rent;
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

  // Insert bill lines
  if (billLines.length > 0) {
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
    const newBalance = currentBalance + -total; // Negative because it's a bill

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

  // Insert ledger records
  if (ledgerRecords.length > 0) {
    const { error: ledgerInsertError } = await supabase
      .from("ledger")
      .insert(ledgerRecords);

    if (ledgerInsertError) {
      console.error("Error inserting ledger records:", ledgerInsertError);
      throw ledgerInsertError;
    }

    console.log(`Created ${ledgerRecords.length} ledger records`);
  }

  return {
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
