// dashboard/src/lib/loan-manager.ts
// Single caller for the Supabase Edge Function from the dashboard

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const FUNCTION_NAME = 'loan-manager'

export async function callLoanManager<T>(body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-client-info': 'loan-tracker-dashboard',
    },
    body: JSON.stringify(body),
  })

  let json: any = null
  try { json = await res.json() } catch {}

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }

  if (!json?.success) {
    throw new Error(json?.error || 'Unknown error from edge function')
  }

  return json as T
}

// Convenience wrappers (optional)
export const getLoans = () => callLoanManager<{ success: true; data: any[] }>({ action: 'get_loans' })
export const createLoan = (params: Record<string, unknown>) => callLoanManager({ action: 'create_loan', ...params })
export const addPayment = (params: Record<string, unknown>) => callLoanManager({ action: 'add_payment', ...params })
export const deleteLoan = (params: Record<string, unknown>) => callLoanManager({ action: 'delete_loan', ...params })

