'use client'

import { useState } from 'react'
import { LoanWithPayments } from '@/lib/hooks/useLoans'
import { format } from 'date-fns'
import { Calendar, DollarSign, TrendingDown, User } from 'lucide-react'

interface LoanCardProps {
  loan: LoanWithPayments
}

export function LoanCard({ loan }: LoanCardProps) {
  const [showAllPayments, setShowAllPayments] = useState(false)
  const progressPercentage = Math.min((loan.total_paid / loan.original_amount) * 100, 100)
  const remainingAmount = loan.current_balance
  const isPaidOff = remainingAmount === 0

  // Calculate the stroke-dasharray for the circular progress
  const circumference = 2 * Math.PI * 45 // radius = 45
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{loan.name}</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {loan.loan_type}
          </span>
        </div>
        {isPaidOff && (
          <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
            PAID OFF! 🎉
          </div>
        )}
      </div>

      {/* Circular Progress Gauge */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={isPaidOff ? "#10b981" : progressPercentage > 75 ? "#f59e0b" : "#3b82f6"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(progressPercentage)}%
              </div>
              <div className="text-xs text-gray-500">
                paid
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center">
            <DollarSign className="w-4 h-4 mr-1" />
            Total Paid
          </span>
          <span className="font-semibold text-green-600">
            ${loan.total_paid.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center">
            <TrendingDown className="w-4 h-4 mr-1" />
            Remaining
          </span>
          <span className="font-semibold text-gray-900">
            ${remainingAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Term
          </span>
          <span className="text-sm text-gray-900">
            {loan.term_months} months
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center">
            <DollarSign className="w-4 h-4 mr-1" />
            Est. Monthly
          </span>
          <span className="font-semibold text-gray-900">
            ${loan.estimated_monthly_payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Recent Payments */}
      {loan.payments.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Payments</h4>
          <div className="space-y-2">
            {(showAllPayments ? loan.payments : loan.payments.slice(0, 2)).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <User className="w-3 h-3 mr-1 text-gray-400" />
                  <span className="text-gray-600">
                    {payment.paid_by} • {format(new Date(payment.payment_date), 'MMM d')}
                  </span>
                </div>
                <span className="font-medium text-gray-900">
                  ${payment.amount}
                </span>
              </div>
            ))}
            {loan.payments.length > 2 && (
              <button
                type="button"
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
                onClick={() => setShowAllPayments((prev) => !prev)}
              >
                {showAllPayments
                  ? 'Show fewer payments'
                  : `Show ${loan.payments.length - 2} more payment${loan.payments.length - 2 === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
