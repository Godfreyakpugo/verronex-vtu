const fs = require("fs");
const path = require("path");
require("dotenv").config();

const DEFAULT_MARKUP = Number(process.env.DEFAULT_MARKUP) || 20;
const DEFAULT_MARKUP_PERCENT =
  Number(process.env.DEFAULT_MARKUP_PERCENT) || 0;

const getSellingPrice = (costPrice) => {
  if (DEFAULT_MARKUP_PERCENT > 0) {
    return Math.round(costPrice * (1 + DEFAULT_MARKUP_PERCENT / 100) * 100) / 100;
  }
  return Math.round((costPrice + DEFAULT_MARKUP) * 100) / 100;
};

const { createClient } = require("@supabase/supabase-js");

const WebSocket = require("ws");

const supabase = createClient(
  process.env.PROJECT_URL || process.env.VITE_SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY,
  {
    realtime: {
      transport: WebSocket,
    },
  }
);

const file = path.join(
  __dirname,
  "../docs/api/gladtidings-products.json"
);

const json = JSON.parse(fs.readFileSync(file, "utf8"));

const rowMap = new Map();

const dataplans = json.Dataplans;

for (const networkName of Object.keys(dataplans)) {
  const networkGroups = dataplans[networkName];

  for (const groupName of Object.keys(networkGroups)) {
    const plans = networkGroups[groupName];

    for (const plan of plans) {
      const costPrice = Number(plan.api_price);

      rowMap.set(`gladtidings-${plan.dataplan_id}`, {
        network: plan.plan_network,
        plan_name: `${plan.plan} (${plan.plan_type})`,
        provider: "gladtidings",
        api_plan_id: String(plan.dataplan_id),
        cost_price: costPrice,
        selling_price: getSellingPrice(costPrice),
        plan_type: plan.plan_type,
        validity: plan.month_validate,
        is_active: true,
      });
    }
  }
}

const rows = [...rowMap.values()];

async function run() {
  const uniqueRows = [];

  const map = new Map();

  for (const row of rows) {
    // Last occurrence wins
    map.set(`${row.provider}-${row.api_plan_id}`, row);
  }

  uniqueRows.push(...map.values());

  console.log(`Original plans: ${rows.length}`);
  console.log(`Unique plans: ${uniqueRows.length}`);

  const { error } = await supabase
    .from("data_plans")
    .upsert(uniqueRows, {
      onConflict: "provider,api_plan_id",
    });

  if (error) {
    console.error(error);
    return;
  }

  console.log("Done!");
}

run();
