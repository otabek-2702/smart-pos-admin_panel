export interface OperatorItem { name: string; quantity: number }
export interface OperatorOrder {
  id: number
  order_number: string | null
  created_at: string
  order_type: 'HALL' | 'DELIVERY' | 'PICKUP'
  place_label: string | null
  items: OperatorItem[] | null
}
export interface OperatorCustomer {
  key: string
  phone: string
  name: string | null
  orders: OperatorOrder[]
}
export interface OperatorQueue {
  date: string
  time_zone: 'Asia/Tashkent'
  from_at: string
  to_at: string
  snapshot_id: string
  total_customers: number
  customers: OperatorCustomer[]
  admin_preview?: boolean
}
