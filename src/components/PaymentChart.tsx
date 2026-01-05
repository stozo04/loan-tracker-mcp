import { LoanWithPayments } from '@/lib/hooks/useLoans'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { format } from 'date-fns'
import { parseLocalISODate } from '@/lib/date'
import { TrendingUp } from 'lucide-react'

interface PaymentChartProps {
  loans: LoanWithPayments[]
}

export function PaymentChart({ loans }: PaymentChartProps) {
  // Get all payments and group by month
  const allPayments = loans.flatMap(loan => loan.payments)
  
  if (allPayments.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center mb-4">
          <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Payment Trends</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No payment data available yet</p>
        </div>
      </div>
    )
  }

  // Group payments by month and person
  const paymentsByMonth = allPayments.reduce((acc, payment) => {
    const monthKey = format(parseLocalISODate(payment.payment_date), 'MMM yyyy')
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthKey,
        Steven: 0,
        Katerina: 0,
        total: 0
      }
    }
    
    acc[monthKey][payment.paid_by as 'Steven' | 'Katerina'] += payment.amount
    acc[monthKey].total += payment.amount
    
    return acc
  }, {} as Record<string, { month: string; Steven: number; Katerina: number; total: number }>)

  // Convert to array and sort by date
  const chartData = Object.values(paymentsByMonth).sort((a, b) => {
    return new Date(a.month).getTime() - new Date(b.month).getTime()
  })

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="flex items-center mb-6">
        <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Trends</h3>
          <p className="text-sm text-gray-600">Monthly contributions by person</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
              labelStyle={{ color: '#374151' }}
            />
            <Bar 
              dataKey="Steven" 
              stackId="payments"
              fill="#3b82f6" 
              radius={[0, 0, 4, 4]}
              name="Steven"
            />
            <Bar 
              dataKey="Katerina" 
              stackId="payments"
              fill="#8b5cf6" 
              radius={[4, 4, 0, 0]}
              name="Katerina"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
          <span className="text-sm text-gray-600">Steven</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
          <span className="text-sm text-gray-600">Katerina</span>
        </div>
      </div>
    </div>
  )
}
