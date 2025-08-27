'use client'

import { useLoans } from '@/lib/hooks/useLoans'
import { LoanCard } from '@/components/LoanCard'
import { DashboardStats } from '@/components/DashboardStats'
import { PaymentChart } from '@/components/PaymentChart'
import { RecentActivity } from '@/components/RecentActivity'
import AiLoanAssistantPro from '@/components/AiLoanChat'

export default function Dashboard() {
  const { loans, loading, error, refetch } = useLoans()
  const handleLoanUpdate = () => refetch()

  if (loading) { /* …your existing loading block… */ }
  if (error) { /* …your existing error block… */ }

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
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your Loans</h2>
          {loans.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-lg">
              <p className="text-gray-500">No loans found. Create one using the AI assistant!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loans.map((loan) => (
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
