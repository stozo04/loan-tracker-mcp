import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Types for our database tables
export interface Loan {
  id: string;
  name: string;
  original_amount: number;
  current_balance: number;
  loan_type: string;
  term_months: number;
  loan_date: string;
  created_date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  paid_by: string;
  payment_date: string;
  created_at: string;
}

// Database client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);