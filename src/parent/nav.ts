// Điều hướng do người tích hợp đấu vào react-router; màn chỉ gọi prop.

export type ParentRoute =
  | 'home'
  | 'ready'
  | 'content'
  | 'goals'
  | 'progress'
  | 'review'
  | 'backup'
  | 'settings'

export interface NavProps {
  onBack?: () => void
  /** `id` dùng cho route cần tham số, ví dụ 'review' cần sessionId. */
  onNavigate?: (route: ParentRoute, id?: string) => void
}
