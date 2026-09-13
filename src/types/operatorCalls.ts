export interface OperatorItem { name: string; quantity: number; comment?: string | null }
export interface OperatorOrderDetails {
  items: OperatorItem[]
  comment: string | null
  delivery_address: string | null
  ready_at: string | null
  preparation_time_seconds: number | null
}
export interface OperatorOrder {
  id: number
  order_number: string | null
  created_at: string
  order_type: 'HALL' | 'DELIVERY' | 'PICKUP'
  place_label: string | null
  comment?: string | null
  delivery_address?: string | null
  ready_at?: string | null
  preparation_time_seconds?: number | null
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
