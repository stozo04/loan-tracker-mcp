import { LoanWithPayments } from '@/lib/hooks/useLoans'
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react'
import { startOfMonth, endOfMonth } from 'date-fns'

interface DashboardStatsProps {
  loans: LoanWithPayments[]
}

export function DashboardStats({ loans }: DashboardStatsProps) {
  // Calculate totals
  const totalOriginalAmount = loans.reduce((sum, loan) => sum + loan.original_amount, 0)
  const totalPaid = loans.reduce((sum, loan) => sum + loan.total_paid, 0)
  const totalRemaining = loans.reduce((sum, loan) => sum + loan.current_balance, 0)

  // Get current month payments
  const currentMonthStart = startOfMonth(new Date())
  const currentMonthEnd = endOfMonth(new Date())
  
  const currentMonthPayments = loans.flatMap(loan => 
    loan.payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date)
      return paymentDate >= currentMonthStart && paymentDate <= currentMonthEnd
    })
  )
  
  const thisMonthPaid = currentMonthPayments.reduce((sum, payment) => sum + payment.amount, 0)

  // Calculate Steven vs Katerina totals
  const allPayments = loans.flatMap(loan => loan.payments)
  const stevenTotal = allPayments
    .filter(payment => payment.paid_by === 'Steven')
    .reduce((sum, payment) => sum + payment.amount, 0)
  
  const katerinaTotal = allPayments
    .filter(payment => payment.paid_by === 'Katerina')
    .reduce((sum, payment) => sum + payment.amount, 0)

  const totalProgress = totalOriginalAmount > 0 ? (totalPaid / totalOriginalAmount) * 100 : 0

  const stats = [
    {
      title: 'Total Debt Remaining',
      value: `$${totalRemaining.toLocaleString()}`,
      subtext: `of $${totalOriginalAmount.toLocaleString()} original`,
      icon: DollarSign,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Total Paid Off',
      value: `$${totalPaid.toLocaleString()}`,
      subtext: `${Math.round(totalProgress)}% of all loans`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'This Month',
      value: `$${thisMonthPaid.toLocaleString()}`,
      subtext: `${currentMonthPayments.length} payments made`,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Top Contributor',
      value: stevenTotal > katerinaTotal ? 'Steven' : katerinaTotal > stevenTotal ? 'Katerina' : 'Tied!',
      subtext: `Steven: $${stevenTotal.toLocaleString()} • Katerina: $${katerinaTotal.toLocaleString()}`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`bg-white rounded-xl p-6 shadow-lg border-2 ${stat.borderColor} hover:shadow-xl transition-all duration-300`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
            </div>
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}