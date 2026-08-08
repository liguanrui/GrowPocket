import api from '@/lib/axios'
import type { ApiResponse } from '@/types'

export type DonationStatus = 1 | 2 | 3

export interface CharityDonation {
  id: number
  family_id: number
  child_id: number
  child_name: string
  project_id: number
  project_title: string
  weight: number
  details?: string
  contact_name?: string
  contact_phone?: string
  address?: string
  points: number
  status: DonationStatus
  created_at: string
  received_at?: string
  completed_at?: string
}

export interface DonationListResult {
  items: CharityDonation[]
  total: number
  page: number
  page_size: number
}

export async function listDonations(params: {
  page?: number
  page_size?: number
  status?: number
  keyword?: string
}): Promise<DonationListResult> {
  const res = await api.get<ApiResponse<DonationListResult>>('/donations', { params })
  return res.data.data
}

export async function confirmDonationReceived(id: number): Promise<void> {
  await api.post(`/donations/${id}/confirm-received`)
}

export async function completeDonation(id: number): Promise<void> {
  await api.post(`/donations/${id}/complete`)
}
