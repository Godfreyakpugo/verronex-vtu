const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.PROJECT_URL || process.env.VITE_SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

const file = path.join(
  __dirname,
  "../docs/api/gladtidings-products.json"
);

const json = JSON.parse(fs.readFileSync(file, "utf8"));

const rows = [];

const dataplans = json.Dataplans;

for (const networkName of Object.keys(dataplans)) {
  const networkGroups = dataplans[networkName];

  for (const groupName of Object.keys(networkGroups)) {
    const plans = networkGroups[groupName];

    for (const plan of plans) {
      rows.push({
        network: plan.plan_network,
        plan_name: `${plan.plan} (${plan.plan_type})`,
        provider: "gladtidings",
        api_plan_id: String(plan.dataplan_id),
        cost_price: Number(plan.api_price),
        selling_price: Number(plan.api_price),
        is_active: true,
      });
    }
  }
}

async function run() {
  console.log(`Importing ${rows.length} plans...`);

  const { error } = await supabase
    .from("data_plans")
    .upsert(rows, {
      onConflict: "provider,api_plan_id",
    });

  if (error) {
    console.error(error);
    return;
  }

  console.log("Done!");
}

run();