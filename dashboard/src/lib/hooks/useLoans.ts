import { useEffect, useState } from 'react'
import { supabase, Loan, Payment } from '@/lib/supabase'

export type LoanWithPayments = Loan & {
  payments: Payment[]
  total_paid: number
  progress_percentage: number
}

export function useLoans() {
  const [loans, setLoans] = useState<LoanWithPayments[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLoans()
  }, [])

  async function fetchLoans() {
    try {
      const { data: loansData, error: loansError } = await supabase
        .from('loan_tracker_loans')
        .select('*')
        .order('created_at', { ascending: false })

      if (loansError) throw loansError

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('loan_tracker_payments')
        .select('*')
        .order('payment_date', { ascending: false })

      if (paymentsError) throw paymentsError

      const loansWithPayments: LoanWithPayments[] = loansData.map(loan => {
        const loanPayments = paymentsData.filter(payment => payment.loan_id === loan.id)
        const totalPaid = loanPayments.reduce((sum, payment) => sum + payment.amount, 0)
        const progressPercentage = (totalPaid / loan.original_amount) * 100

        return {
          ...loan,
          payments: loanPayments,
          total_paid: totalPaid,
          progress_percentage: Math.min(progressPercentage, 100)
        }
      })

      setLoans(loansWithPayments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { loans, loading, error, refetch: fetchLoans }
}