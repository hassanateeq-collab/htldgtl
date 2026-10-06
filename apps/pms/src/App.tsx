import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { BookingDetailScreen } from '@/screens/BookingDetailScreen'
import { BookingsScreen } from '@/screens/BookingsScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { RoomsScreen } from '@/screens/RoomsScreen'
import { TodayScreen } from '@/screens/TodayScreen'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayScreen />} />
        <Route path="calendar" element={<CalendarScreen />} />
        <Route path="bookings" element={<BookingsScreen />} />
        <Route path="bookings/:id" element={<BookingDetailScreen />} />
        <Route path="rooms" element={<RoomsScreen />} />
        <Route path="more" element={<MoreScreen />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
