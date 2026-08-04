# Verronex VTU - Project Status

## Current Provider

- Gladtidings ONLY
- Wazobia completely removed

## Backend

- Supabase
- Edge Functions
- React + Vite
- Wallet-first architecture

## Database

### data_plans

- provider
- api_plan_id
- network
- plan_name
- cost_price
- selling_price
- plan_type
- validity
- is_active

350 plans imported successfully.

### wallets

Stores user balances.

### transactions

reference is UNIQUE.

## SQL Functions

### start_data_purchase

Status:
Completed.

Responsibilities:

- lock wallet
- verify balance
- deduct wallet
- create pending transaction
- return:
  transaction_id
  api_plan_id
  network
  phone_price

### refund_purchase

Status:
Completed.

Responsibilities:

- refund wallet
- mark transaction failed

## Edge Function

purchase-data

Status:
Deployed successfully.

Responsibilities:

- authenticate user
- call start_data_purchase
- call Gladtidings
- mark transaction successful
- call refund_purchase on failure

Current deployment:
SUCCESS

## Pricing

Customers are charged from selling_price.

cost_price stores provider price.

Current markup:
+₦20

Importer:
scripts/import-gladtidings-plans.cjs

Imports:
350 unique plans.

## Remaining Work

1. Build BuyData.jsx
2. Fetch plans from Supabase
3. Purchase UI
4. Connect purchase-data Edge Function
5. Success/error UI
6. Airtime implementation
7. Admin product management
8. Automatic Gladtidings price sync
