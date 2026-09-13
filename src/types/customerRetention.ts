/** Versioned, minimal order snapshot. Never includes tokens, addresses or order notes. */
export interface RetentionOrder {
  id: number
  order_number: string | null
  customer_id: number | null
  customer_name: string | null
  customer_phone: string | null
  customer_is_staff: boolean
  phone_number: string | null
  created_at: string
  updated_at: string | null
  order_origin: string | null
  status: string
  is_paid: boolean
  order_type: string
  total_amount: string
}

export interface RetentionSnapshot {
  schema_version: 1
  from_at: string
  to_at: string
  collected_at: string
  source_api: string
  scope: 'authenticated_account'
  record_count: number
  total_pages: number
  consistency: 'pagination_verified_not_transactional'
  collection_windows?: { from_at: string; to_at: string; record_count: number; total_pages: number }[]
  orders: RetentionOrder[]
}

export interface RetentionRules {
  one_time_days: number
  repeat_min_days: number
  repeat_gap_multiplier: number
}

export type RetentionSegment = 'ONE_TIME_INACTIVE' | 'REPEAT_INACTIVE' | 'ACTIVE'

export interface RetentionCustomer {
  key: string
  phone: string
  name: string | null
  order_count: number
  first_order_at: string
  last_order_at: string
  inactive_days: number
  median_gap_days: number | null
  inactive_after_days: number
  overdue_days: number
  segment: RetentionSegment
  cadence_confidence: 'LIMITED' | 'OBSERVED'
  total_spent: number
  order_types: string[]
  orders: RetentionOrder[]
}

export interface RetentionAnalysis {
  customers: RetentionCustomer[]
  metrics: {
    collected_orders: number
    eligible_orders: number
    identified_orders: number
    anonymous_orders: number
    invalid_phone_orders: number
    staff_orders: number
    phone_conflict_orders: number
    customers: number
    one_time_inactive: number
    repeat_inactive: number
    active: number
  }
}

export interface RetentionCollectionProgress {
  phase: 'collecting' | 'verifying'
  loaded: number
  total: number
  page: number
  total_pages: number
  completed_windows?: number
  total_windows?: number
  verified_orders?: number
}

export type RetentionCallOutcome = 'REACHED' | 'NO_ANSWER' | 'CALL_BACK' | 'WRONG_NUMBER' | 'DO_NOT_CONTACT'

export interface RetentionCallPayload {
  outcome: RetentionCallOutcome
  reason_code: string | null
  notes: string
  next_follow_up_at: string | null
  expected_version: number
}

export interface RetentionCallRecord extends Omit<RetentionCallPayload, 'expected_version'> {
  id: string
  created_at: string
  created_by: { id: number; name: string }
}

export interface RetentionContactState {
  customer_key: string
  version: number
  do_not_contact: boolean
  invalid_number: boolean
  next_follow_up_at: string | null
  calls: RetentionCallRecord[]
}
