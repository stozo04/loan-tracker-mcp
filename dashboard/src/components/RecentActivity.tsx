import { LoanWithPayments } from '@/lib/hooks/useLoans'
import { format, formatDistanceToNow } from 'date-fns'
import { Activity, DollarSign, User, Calendar } from 'lucide-react'

interface RecentActivityProps {
  loans: LoanWithPayments[]
}

export function RecentActivity({ loans }: RecentActivityProps) {
  // Get all payments and sort by most recent
  const allPayments = loans
    .flatMap(loan => 
      loan.payments.map(payment => ({
        ...payment,
        loan_name: loan.name,
        loan_type: loan.loan_type
      }))
    )
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 8) // Show last 8 activities

  if (allPayments.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center mb-4">
          <Activity className="w-5 h-5 mr-2 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No recent activity</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <Activity className="w-5 h-5 mr-2 text-green-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <p className="text-sm text-gray-600">Latest payments and updates</p>
        </div>
      </div>

      <div className="space-y-4 max-h-64 overflow-y-auto">
        {allPayments.map((payment) => (
          <div key={payment.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
            <div className={`p-2 rounded-full ${
              payment.paid_by === 'Steven' ? 'bg-blue-100' : 'bg-purple-100'
            }`}>
              <DollarSign className={`w-4 h-4 ${
                payment.paid_by === 'Steven' ? 'text-blue-600' : 'text-purple-600'
              }`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {payment.paid_by} made a payment
                  </p>
                  <p className="text-sm text-gray-600">
                    ${payment.amount.toLocaleString()} toward {payment.loan_name}
                  </p>
                  <div className="flex items-center mt-1 space-x-3">
                    <span className="inline-flex items-center text-xs text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {payment.loan_type}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(payment.payment_date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {allPayments.length === 8 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">Showing recent 8 activities</p>
        </div>
      )}
    </div>
  )
}