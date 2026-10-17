-- =============================================================================
-- READ-ONLY REPORT — historical data-purchase provider cost recoverability
-- STATUS: report only. Contains SELECTs exclusively. Safe to run repeatedly.
--   Run each statement separately; the CLI prints only the last result set.
-- =============================================================================
-- WHY
--   Before CHANGE 1, public.complete_data_purchase replaced transaction
--   metadata with the raw Gladtidings body, destroying the cost_price captured
--   at purchase time. For those historical rows the provider cost is unknown.
--
--   This report classifies every successful `data` transaction into exactly one
--   bucket so nobody has to guess:
--
--     cost_known              metadata.cost_price is present.
--                             -> exact provider cost. Use as-is.
--
--     cost_unknown_unrecoverable
--                             cost_price missing AND the plan cannot be
--                             identified from data_plans with certainty.
--                             -> provider cost is NOT recoverable. Treat as
--                                unknown. Do NOT substitute today's
--                                data_plans.cost_price.
--
--     cost_unknown_estimable  cost_price missing BUT exactly one active
--                             data_plans row matches on network + plan_name +
--                             selling_price = the amount charged.
--                             -> ESTIMATE ONLY, clearly labelled. Even here the
--                                plan's cost_price may have changed since the
--                                purchase, so it is not an exact historical
--                                cost.
--
-- MEASURED ON LIVE DATA (2026-10-07, read-only)
--   successful data rows              159
--   cost_known                          1
--   cost_unknown                      158
--   cost_unknown_estimable             0   <-- nothing is recoverable
--   cost_unknown_unrecoverable       158
--
--   Why nothing is recoverable: the surviving metadata plan_name values match
--   ZERO rows in data_plans (0/158). The provider's plan_name echo uses
--   different text from data_plans.plan_name, and api_plan_id was destroyed
--   along with cost_price, so there is no key back to the plan.
--   Matching on amount alone succeeds for 153 rows, but selling_price is not
--   cost and many plans share a price, so it proves nothing.
--
--   CONSEQUENCE: after CHANGE 1, the honest total is
--   "sales for N transactions, provider cost known for M of them".
--   Any profit figure covering the historical window is an UNDERSTATEMENT of
--   coverage at best, and must not be presented as complete.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Report A — bucket counts for all successful data transactions
-- -----------------------------------------------------------------------------
with hist as (
  select t.id,
         t.amount,
         t.created_at,
         nullif(t.metadata ->> 'cost_price', '')::numeric as cost_price,
         nullif(t.metadata ->> 'plan_name',   '')         as plan_name,
         nullif(t.metadata ->> 'plan_network','')         as network
    from public.transactions t
   where t.category = 'data'
     and t.status   = 'successful'
),
matched as (
  select h.*,
         (select count(*)
            from public.data_plans d
           where d.plan_name     = h.plan_name
             and d.network       = h.network
             and d.selling_price = h.amount
             and d.is_active) as exact_plan_matches
    from hist h
)
select
  case
    when cost_price is not null                    then 'cost_known'
    when plan_name is null                          then 'cost_unknown_unrecoverable_no_plan_name'
    when exact_plan_matches = 1                    then 'cost_unknown_ESTIMATE_ONLY'
    else                                                'cost_unknown_unrecoverable'
  end                                   as bucket,
  count(*)                               as rows,
  round(sum(amount), 2)                  as sales_charged,
  round(sum(cost_price), 2)              as exact_cost_known,
  round(sum(amount) - sum(cost_price), 2) as profit_over_known_cost_only
from matched
group by 1
order by 1;


-- -----------------------------------------------------------------------------
-- Report B — sales coverage per day, so the accounting UI can show which days
--            are incomplete rather than implying full coverage
-- -----------------------------------------------------------------------------
with hist as (
  select (t.created_at at time zone 'Africa/Lagos')::date as day,
         t.amount,
         nullif(t.metadata ->> 'cost_price', '')::numeric as cost_price
    from public.transactions t
   where t.category = 'data'
     and t.status   = 'successful'
)
select day,
       count(*)                                   as data_transactions,
       round(sum(amount), 2)                     as sales,
       count(*) filter (where cost_price is not null) as cost_known,
       count(*) filter (where cost_price is null)      as cost_unknown,
       round(sum(cost_price), 2)                  as exact_cost_known
from hist
group by day
order by day desc;


-- -----------------------------------------------------------------------------
-- Report C — reconcile the ledger against the wallets, to size the refund gap
--            described in refund_purchase_ledger_entry_OPTIONAL.sql
-- -----------------------------------------------------------------------------
select
  (select round(coalesce(sum(balance), 0), 2) from public.wallets) as total_wallet_balances,
  (select round(sum(amount) filter (where type = 'credit'), 2)
     from public.transactions)                                    as ledger_credits,
  (select round(sum(amount) filter (where type = 'debit'), 2)
     from public.transactions)                                    as ledger_debits,
  (select round(coalesce(sum(balance), 0), 2)
     - (select coalesce(sum(amount) filter (where type = 'credit'), 0)
        - coalesce(sum(amount) filter (where type = 'debit'), 0)
        from public.transactions), 2)                             as unexplained_difference;


-- -----------------------------------------------------------------------------
-- Report D — data-plan price drift, which is why a historical cost can never be
--            reconstructed from today's data_plans with confidence
-- -----------------------------------------------------------------------------
select
  count(*)                                        as plans,
  count(*) filter (where is_active)               as active_plans,
  min(updated_at)                                as earliest_update,
  max(updated_at)                                as latest_update,
  count(*) filter (where updated_at > now() - interval '30 days') as changed_last_30d
from public.data_plans;