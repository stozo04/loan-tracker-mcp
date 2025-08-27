import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Loan = {
  id: string
  name: string
  original_amount: number
  current_balance: number
  loan_type: string
  term_months: number
  loan_date: string
  created_date: string
  created_at: string
}

export type Payment = {
  id: string
  loan_id: string
  amount: number
  paid_by: string
  payment_date: string
  created_at: string
}