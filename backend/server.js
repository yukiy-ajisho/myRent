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

// GET /bootstrap - 初期データ取得
app.get("/bootstrap", async (req, res) => {
  try {
    const { property_id, month_start } = req.query;

    // Get all properties
    const { data: properties, error: propertiesError } = await supabase
      .from("property")
      .select("*")
      .eq("active", true);

    if (propertiesError) throw propertiesError;

    // Get all division rules
    const { data: divisionRules, error: rulesError } = await supabase
      .from("division_rule_default")
      .select("*");

    if (rulesError) throw rulesError;

    let utilityActuals = [];
    if (property_id && month_start) {
      const { data, error } = await supabase
        .from("utility_actual")
        .select("*")
        .eq("property_id", property_id)
        .eq("month_start", month_start);

      if (error) throw error;
      utilityActuals = data;
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
    const { property_id, stay_periods } = req.body;

    if (!property_id || !stay_periods) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Delete existing stay records for this property
    await supabase.from("stay_record").delete().eq("property_id", property_id);

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

    res.json({ ok: true, records_saved: stayRecords.length });
  } catch (error) {
    console.error("Save stay periods error:", error);
    res.status(500).json({ error: "Failed to save stay periods" });
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

// GET /dump-all - 全テーブルダンプ
app.get("/dump-all", async (req, res) => {
  try {
    const tables = [
      "property",
      "app_user",
      "user_property",
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

    const dump = {};

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*");

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
  const monthEnd = new Date(month_start);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0); // Last day of month

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

  // Get active tenant users for this property from user_property
  const { data: userProperties, error: userPropsError } = await supabase
    .from("user_property")
    .select(
      `
      user_id,
      app_user!inner(*)
    `
    )
    .eq("property_id", property_id)
    .eq("active", true);

  if (userPropsError) throw userPropsError;

  // Filter for active tenants
  const propertyUsers = userProperties
    .map((up) => up.app_user)
    .filter((user) => user.active === true && user.user_type === "tenant");

  // Calculate days present for each user
  const userDays = {};
  const monthStartDate = new Date(month_start);
  const daysInMonth = monthEnd.getDate();

  // Use manual stay periods if provided, otherwise calculate from stay records
  if (Object.keys(manualStayPeriods).length > 0) {
    // Phase 2: Use manually input stay periods
    propertyUsers.forEach((user) => {
      const period = manualStayPeriods[user.user_id];
      if (period && period.startDate && period.endDate) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        const daysPresent = Math.max(
          0,
          Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
        );
        userDays[user.user_id] = daysPresent;
      } else {
        userDays[user.user_id] = 0;
      }
    });
  } else {
    // Fallback: Calculate from stay records (original logic)
    const { data: stayRecords, error: stayError } = await supabase
      .from("stay_record")
      .select("*")
      .eq("property_id", property_id)
      .or(
        `and(start_date.lte.${
          monthEnd.toISOString().split("T")[0]
        },end_date.gte.${month_start})`
      );

    if (stayError) throw stayError;

    stayRecords.forEach((stay) => {
      const stayStart = new Date(
        Math.max(new Date(stay.start_date), monthStartDate)
      );
      const stayEnd = new Date(Math.min(new Date(stay.end_date), monthEnd));
      const daysPresent = Math.max(
        0,
        Math.ceil((stayEnd - stayStart) / (1000 * 60 * 60 * 24)) + 1
      );

      if (!userDays[stay.user_id]) {
        userDays[stay.user_id] = 0;
      }
      userDays[stay.user_id] += daysPresent;
    });
  }

  const headcount = Object.keys(userDays).length;
  const totalPersonDays = Object.values(userDays).reduce(
    (sum, days) => sum + days,
    0
  );

  // Get division rules
  const { data: divisionRules, error: rulesError } = await supabase
    .from("division_rule_default")
    .select("*")
    .eq("property_id", property_id);

  if (rulesError) throw rulesError;

  const rulesMap = {};
  divisionRules.forEach((rule) => {
    rulesMap[rule.utility] = rule.method;
  });

  // Get utility actuals
  const { data: utilityActuals, error: actualsError } = await supabase
    .from("utility_actual")
    .select("*")
    .eq("property_id", property_id)
    .eq("month_start", month_start);

  if (actualsError) throw actualsError;

  // Get tenant rents
  const { data: tenantRents, error: rentsError } = await supabase
    .from("tenant_rent")
    .select("*")
    .eq("property_id", property_id)
    .lte("start_date", month_start)
    .gte("end_date", month_start);

  if (rentsError) throw rentsError;

  const billLines = [];
  let totalRent = 0;
  let totalUtilities = 0;

  // Process rent
  tenantRents.forEach((rent) => {
    const daysPresent = userDays[rent.user_id] || 0;
    const rentAmount =
      Math.round(((rent.monthly_rent * daysPresent) / daysInMonth) * 100) / 100;

    billLines.push({
      bill_run_id: billRun.bill_run_id,
      user_id: rent.user_id,
      utility: "rent",
      amount: rentAmount,
      detail_json: {
        days_present: daysPresent,
        monthly_rent: rent.monthly_rent,
      },
    });

    totalRent += rentAmount;
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

  // Insert bill lines
  if (billLines.length > 0) {
    const { error: insertError } = await supabase
      .from("bill_line")
      .insert(billLines);

    if (insertError) throw insertError;
  }

  return {
    bill_run_id: billRun.bill_run_id,
    lines_created: billLines.length,
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
