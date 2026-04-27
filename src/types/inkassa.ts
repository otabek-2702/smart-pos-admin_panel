export interface InkassaBalance {
  balance: string
  last_updated: string
}

export interface TopProduct {
  product_id: number
  product_name: string
  quantity_sold: number
  revenue: string
}

export interface CategoryRevenue {
  category: string
  revenue: string
  items_sold: number
}

export interface CashierPerformance {
  cashier_id: number | null
  cashier_name: string
  order_count: number
  total_revenue: string
}

export interface InkassaStatsSummary {
  total_orders: number
  paid_orders: number
  ready_orders: number
  total_revenue: string
  average_order_value: string
}

export interface InkassaStats {
  period_start: string
  current_time: string
  cash_register: {
    current_balance: string
    last_updated: string
  }
  summary: InkassaStatsSummary
  cashier_performance: CashierPerformance[]
  top_products: TopProduct[]
  category_revenue: CategoryRevenue[]
}
