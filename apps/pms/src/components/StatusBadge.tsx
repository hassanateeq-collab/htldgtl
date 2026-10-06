import type { BookingStatus } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { statusLabel } from '@/lib/labels'

const styles: Record<BookingStatus, string> = {
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  checked_in: 'border-green-200 bg-green-50 text-green-700',
  checked_out: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  no_show: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-zinc-200 bg-zinc-50 text-zinc-500 line-through',
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge className={styles[status]}>{statusLabel(status)}</Badge>
}
