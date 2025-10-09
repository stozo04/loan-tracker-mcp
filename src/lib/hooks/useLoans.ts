import { useEffect, useState } from 'react'
import { callLoanManager } from '@/lib/loan-manager'
import type { Loan as LoanRow, LoanComputed } from '../../index'
import { deriveLoan } from '../../index'

export type LoanWithPayments = LoanComputed

export function useLoans() {
  const [loans, setLoans] = useState<LoanWithPayments[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchLoans()
  }, [])

  async function fetchLoans() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await callLoanManager<{ success: true; data: LoanRow[] }>({ action: 'get_loans' })
      const mapped: LoanWithPayments[] = (data || []).map((loan) => deriveLoan(loan as any))

      setLoans(mapped)
    } catch (err: any) {
      setError(err?.message || 'Failed to load loans')
    } finally {
      setLoading(false)
    }
  }

  return { loans, loading, error, refetch: fetchLoans }
}
