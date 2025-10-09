'use client'

import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useLoans } from '@/lib/hooks/useLoans'
import { LoanCard } from '@/components/LoanCard'
import { DashboardStats } from '@/components/DashboardStats'
import { PaymentChart } from '@/components/PaymentChart'
import { RecentActivity } from '@/components/RecentActivity'
import AiLoanAssistantPro from '@/components/AiLoanChat'

export default function Dashboard() {
  const { loans, loading, error, refetch } = useLoans()
  const [showPaidOff, setShowPaidOff] = useState(false)
  const handleLoanUpdate = () => refetch()

  const paidOffCount = loans.filter(loan => loan.is_paid_off).length
  const visibleLoans = showPaidOff ? loans : loans.filter(loan => !loan.is_paid_off)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-2xl px-10 py-8 flex flex-col items-center text-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <div>
            <p className="text-lg font-semibold text-gray-900">Loading your dashboard</p>
            <p className="text-sm text-gray-500">Fetching loans, payments, and portfolio stats…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-2xl px-10 py-8 flex flex-col items-center text-center gap-4">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <div>
            <p className="text-lg font-semibold text-gray-900">Something went wrong</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Steven &amp; Katerina&apos;s Loan Tracker
            </h1>
            <p className="text-gray-600">
              Track your loans and payments with an AI assistant
            </p>
          </div>
        </div>

        {/* Dashboard Stats */}
        <DashboardStats loans={loans} />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PaymentChart loans={loans} />
          <RecentActivity loans={loans} />
        </div>

        {/* Loans Grid */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Your Loans</h2>
            {paidOffCount > 0 && (
              <button
                type="button"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
                onClick={() => setShowPaidOff(prev => !prev)}
              >
                {showPaidOff
                  ? 'Hide paid off loans'
                  : `Show ${paidOffCount} paid off loan${paidOffCount === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          {loans.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-lg">
              <p className="text-gray-500">No loans found. Create one using the AI assistant!</p>
            </div>
          ) : visibleLoans.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-lg">
              <p className="text-gray-500">All loans are paid off. Use the toggle above to view them.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleLoans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating AI assistant */}
      <AiLoanAssistantPro onLoanUpdate={handleLoanUpdate} />
    </div>
  )
}
