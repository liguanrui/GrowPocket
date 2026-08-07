import api from '@/lib/axios'
import type {
  ApiResponse,
  Paged,
  ChildListItem,
  ChildDetailDTO,
} from '@/types'

type ListChildrenParams = {
  page?: number
  page_size?: number
  search?: string
  grade?: number
  family_id?: number
}

export async function listChildren(
  params: ListChildrenParams = {}
): Promise<Paged<ChildListItem>> {
  const res = await api.get<ApiResponse<Paged<ChildListItem>>>('/children', {
    params,
  })
  return res.data.data
}

export async function getChildDetail(id: number): Promise<ChildDetailDTO> {
  const res = await api.get<ApiResponse<ChildDetailDTO>>(`/children/${id}`)
  return res.data.data
}
