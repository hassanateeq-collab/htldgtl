import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireTenant } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { BookingDetailScreen } from '@/screens/BookingDetailScreen'
import { BookingsScreen } from '@/screens/BookingsScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { LoginEntryScreen } from '@/screens/LoginEntryScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { NewBookingScreen } from '@/screens/NewBookingScreen'
import { RoomsScreen } from '@/screens/RoomsScreen'
import { SelectTenantScreen } from '@/screens/SelectTenantScreen'
import { TodayScreen } from '@/screens/TodayScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginEntryScreen />} />
      <Route path="/t/:slug/login" element={<LoginScreen />} />

      <Route element={<RequireAuth />}>
        <Route path="/select-tenant" element={<SelectTenantScreen />} />

        <Route element={<RequireTenant />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/today" replace />} />
            <Route path="today" element={<TodayScreen />} />
            <Route path="calendar" element={<CalendarScreen />} />
            <Route path="bookings" element={<BookingsScreen />} />
            <Route path="bookings/new" element={<NewBookingScreen />} />
            <Route path="bookings/:id" element={<BookingDetailScreen />} />
            <Route path="rooms" element={<RoomsScreen />} />
            <Route path="more" element={<MoreScreen />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}
