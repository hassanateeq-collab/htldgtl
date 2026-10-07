import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Check, Sparkles, Wrench } from 'lucide-react'
import { t, type HousekeepingStatus } from '@hotel-digital/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Menu, MenuItem } from '@/components/ui/menu'
import { EmptyState, Skeleton, toast } from '@/components/ui/feedback'
import { Page, PageHeader, SectionTitle } from '@/components/patterns/Page'
import { HkBadge } from '@/components/patterns/display'
import { QueryState } from '@/components/patterns/state'
import { useHotelToday, useTenant } from '@/data/tenant'
import { useRoomsBoard, useSetRoomStatus } from '@/data/rooms'
import type { RoomBoardVM } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { hkLabel } from '@/lib/labels'

const ORDER: HousekeepingStatus[] = ['dirty', 'clean', 'inspected', 'out_of_order']

export default function HousekeepingScreen() {
  const { can } = useTenant()
  const today = useHotelToday()
  const boardQ = useRoomsBoard()
  const setStatus = useSetRoomStatus()
  const rooms = useMemo(() => (boardQ.data ?? []).filter((r) => r.isActive), [boardQ.data])
  const groups = ORDER.map((s) => ({ status: s, rooms: rooms.filter((r) => r.housekeepingStatus === s) }))
  const counts = {
    dirty: groups[0]!.rooms.length,
    inspected: groups[2]!.rooms.length,
    ooo: groups[3]!.rooms.length,
  }
  const canChange = can('rooms.status')

  async function change(room: RoomBoardVM, status: HousekeepingStatus) {
    try {
      await setStatus.mutateAsync({ roomId: room.id, status })
      toast.success(t('hk.changed', { room: room.label, status: hkLabel(status).toLowerCase() }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Page width="xl">
      <PageHeader title={t('hk.title')} subtitle={t('hk.summary', { dirty: counts.dirty, inspected: counts.inspected, ooo: counts.ooo })} />
      <QueryState pending={boardQ.isPending} error={boardQ.error} onRetry={() => void boardQ.refetch()} skeleton={<Skeleton className="h-64" />}>
        {rooms.length === 0 ? (
          <EmptyState title={t('rooms.empty')} />
        ) : (
          groups.map(({ status, rooms: list }) =>
            list.length === 0 && status !== 'dirty' ? null : (
              <section key={status} className="space-y-2">
                <SectionTitle count={list.length}>
                  <span className="inline-flex items-center gap-2">
                    <HkBadge status={status} /> {status === 'dirty' ? t('rooms.filter.dirty') : hkLabel(status)}
                  </span>
                </SectionTitle>
                {list.length === 0 ? (
                  <EmptyState title={t('hk.allClean')} icon={<Check className="h-5 w-5" aria-hidden />} />
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((r) => {
                      const occupied = r.current !== null
                      const departing = occupied && r.current!.checkOut <= today
                      const arriving = !occupied && r.next?.checkIn === today
                      return (
                        <Card key={r.id} className="flex items-center gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="tnum text-lg font-semibold leading-none">
                              {r.label} <span className="text-sm font-normal text-muted-foreground">· {r.roomTypeName}</span>
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {occupied && !departing && <Badge tone="inhouse">{t('hk.occupied')} · {r.current!.guestName}</Badge>}
                              {departing && <Badge tone="warning">{t('hk.departingToday')}</Badge>}
                              {arriving && <Badge tone="confirmed">{t('hk.arrivingToday')}</Badge>}
                              {!occupied && !arriving && <span className="text-sm text-muted-foreground">{t('rooms.free')}</span>}
                            </div>
                          </div>
                          {canChange && (
                            <div className="flex shrink-0 items-center gap-1">
                              {status === 'dirty' && (
                                <Button onClick={() => void change(r, 'clean')} disabled={setStatus.isPending}>
                                  <Check className="h-4 w-4" aria-hidden />
                                  {t('hk.mark.clean')}
                                </Button>
                              )}
                              {status === 'clean' && (
                                <Button variant="outline" onClick={() => void change(r, 'inspected')} disabled={setStatus.isPending}>
                                  <Sparkles className="h-4 w-4" aria-hidden />
                                  {t('hk.mark.inspected')}
                                </Button>
                              )}
                              {status === 'out_of_order' && (
                                <Button variant="outline" onClick={() => void change(r, 'clean')} disabled={setStatus.isPending}>
                                  <Check className="h-4 w-4" aria-hidden />
                                  {t('hk.mark.clean')}
                                </Button>
                              )}
                              <Menu
                                trigger={
                                  <Button variant="ghost" size="icon" aria-label={t('rooms.setStatus')}>
                                    <Wrench className="h-5 w-5" aria-hidden />
                                  </Button>
                                }
                              >
                                {ORDER.filter((s) => s !== status).map((s) => (
                                  <MenuItem key={s} onSelect={() => void change(r, s)}>
                                    {t(`hk.mark.${s}`)}
                                  </MenuItem>
                                ))}
                                {r.current && (
                                  <MenuItem asChild>
                                    <Link to={`/bookings/${r.current.bookingId}`}>{t('rooms.openBooking')}</Link>
                                  </MenuItem>
                                )}
                              </Menu>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}
              </section>
            ),
          )
        )}
      </QueryState>
    </Page>
  )
}
