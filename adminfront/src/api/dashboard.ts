import api from '@/lib/axios'
import type {
  ApiResponse,
  OverviewStats,
  TrendStats,
  AbilityRadar,
} from '@/types'

export async function getOverview(): Promise<OverviewStats> {
  const res = await api.get<ApiResponse<OverviewStats>>('/dashboard/stats')
  return res.data.data
}

export async function getTrends(days: number = 30): Promise<TrendStats> {
  const res = await api.get<ApiResponse<TrendStats>>('/dashboard/trends', {
    params: { days },
  })
  return res.data.data
}

export async function getAbilityRadar(): Promise<AbilityRadar> {
  const res = await api.get<ApiResponse<AbilityRadar>>('/dashboard/ability-radar')
  return res.data.data
}
