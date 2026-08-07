import api from '@/lib/axios'
import type {
  ApiResponse,
  Paged,
  FamilyListDTO,
  FamilyDetailDTO,
  ParentListItem,
} from '@/types'

type ListFamiliesParams = {
  page?: number
  page_size?: number
  search?: string
  status?: 'active' | 'inactive' | 'all'
  sort?: string
}

type ListParentsParams = {
  page?: number
  page_size?: number
  search?: string
  family_id?: number
}

export async function listFamilies(
  params: ListFamiliesParams = {}
): Promise<Paged<FamilyListDTO>> {
  const res = await api.get<ApiResponse<Paged<FamilyListDTO>>>('/families', {
    params,
  })
  return res.data.data
}

export async function getFamilyDetail(id: number): Promise<FamilyDetailDTO> {
  const res = await api.get<ApiResponse<FamilyDetailDTO>>(`/families/${id}`)
  return res.data.data
}

export async function toggleFamilyStatus(
  id: number,
  reason?: string
): Promise<void> {
  await api.put<ApiResponse<void>>(`/families/${id}/status`, { reason })
}

export async function listParents(
  params: ListParentsParams = {}
): Promise<Paged<ParentListItem>> {
  const res = await api.get<ApiResponse<Paged<ParentListItem>>>('/parents', {
    params,
  })
  return res.data.data
}
