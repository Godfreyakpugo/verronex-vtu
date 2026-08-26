import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!hasSupabaseConfig) {
  console.warn('Missing Supabase environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const noopChain = {
  eq: () => noopChain,
  neq: () => noopChain,
  gt: () => noopChain,
  gte: () => noopChain,
  lt: () => noopChain,
  lte: () => noopChain,
  like: () => noopChain,
  ilike: () => noopChain,
  in: () => noopChain,
  is: () => noopChain,
  order: () => noopChain,
  limit: () => noopChain,
  range: () => noopChain,
  single: async () => ({ data: null, error: null }),
  then: (resolve) => resolve({ data: [], error: null }),
}

const noopFrom = () => ({
  select: () => noopChain,
  insert: () => ({ ...noopChain, select: () => noopChain }),
  update: () => noopChain,
  upsert: () => ({ ...noopChain, select: () => noopChain }),
  delete: () => noopChain,
})

const createNoopSupabaseClient = () => ({
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }),
    signUp: async () => ({ data: null, error: new Error('Supabase is not configured') }),
    signInWithPassword: async () => ({ data: null, error: new Error('Supabase is not configured') }),
    signInWithOtp: async () => ({ data: null, error: new Error('Supabase is not configured') }),
    updateUser: async () => ({ data: null, error: new Error('Supabase is not configured') }),
    signOut: async () => ({ error: null }),
  },
  from: noopFrom,
  rpc: async () => ({ data: null, error: null }),
  functions: {
    invoke: async () => ({
      data: null,
      error: new Error('Supabase is not configured'),
    }),
  },
})

const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createNoopSupabaseClient()

export default supabase
