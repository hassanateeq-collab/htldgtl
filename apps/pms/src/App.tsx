import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireTenant } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { BookingDetailScreen } from '@/screens/BookingDetailScreen'
import { BookingsScreen } from '@/screens/BookingsScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { EditBookingScreen } from '@/screens/EditBookingScreen'
import { GuestDetailScreen } from '@/screens/GuestDetailScreen'
import { GuestsScreen } from '@/screens/GuestsScreen'
import { LoginEntryScreen } from '@/screens/LoginEntryScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { NewBookingScreen } from '@/screens/NewBookingScreen'
import { ReceiptScreen } from '@/screens/ReceiptScreen'
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
            <Route path="bookings/:id/edit" element={<EditBookingScreen />} />
            <Route path="bookings/:id" element={<BookingDetailScreen />} />
            <Route path="guests" element={<GuestsScreen />} />
            <Route path="guests/:id" element={<GuestDetailScreen />} />
            <Route path="rooms" element={<RoomsScreen />} />
            <Route path="more" element={<MoreScreen />} />
          </Route>
          {/* Print view: no shell chrome, so the receipt is the whole page. */}
          <Route path="bookings/:id/receipt" element={<ReceiptScreen />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}
