import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAbility, RequireAuth, RequireTenant } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { Loading, ScreenErrorBoundary } from '@/components/patterns/state'
import { Toaster } from '@/components/ui/feedback'

// Every screen is its own chunk; the shell stays visible while one loads.
const LoginEntryScreen = lazy(() => import('@/screens/LoginEntryScreen'))
const LoginScreen = lazy(() => import('@/screens/LoginScreen'))
const SelectTenantScreen = lazy(() => import('@/screens/SelectTenantScreen'))
const TodayScreen = lazy(() => import('@/screens/TodayScreen'))
const RoomsScreen = lazy(() => import('@/screens/RoomsScreen'))
const CalendarScreen = lazy(() => import('@/screens/CalendarScreen'))
const BookingsScreen = lazy(() => import('@/screens/BookingsScreen'))
const BookingDetailScreen = lazy(() => import('@/screens/BookingDetailScreen'))
const NewBookingScreen = lazy(() => import('@/screens/NewBookingScreen'))
const EditBookingScreen = lazy(() => import('@/screens/EditBookingScreen'))
const ReceiptScreen = lazy(() => import('@/screens/ReceiptScreen'))
const RegistrationCardScreen = lazy(() => import('@/screens/RegistrationCardScreen'))
const GuestsScreen = lazy(() => import('@/screens/GuestsScreen'))
const GuestDetailScreen = lazy(() => import('@/screens/GuestDetailScreen'))
const HousekeepingScreen = lazy(() => import('@/screens/HousekeepingScreen'))
const CashScreen = lazy(() => import('@/screens/CashScreen'))
const DailyReportScreen = lazy(() => import('@/screens/DailyReportScreen'))
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen'))
const MoreScreen = lazy(() => import('@/screens/MoreScreen'))
const NotFoundScreen = lazy(() => import('@/screens/NotFoundScreen'))

export default function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginEntryScreen />} />
          <Route path="/t/:slug/login" element={<LoginScreen />} />

          <Route element={<RequireAuth />}>
            <Route path="/select-tenant" element={<SelectTenantScreen />} />

            <Route element={<RequireTenant />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<TodayScreen />} />
                <Route path="rooms" element={<RoomsScreen />} />
                <Route path="calendar" element={<CalendarScreen />} />
                <Route path="bookings" element={<BookingsScreen />} />
                <Route element={<RequireAbility ability="bookings.create" />}>
                  <Route path="bookings/new" element={<NewBookingScreen />} />
                </Route>
                <Route element={<RequireAbility ability="bookings.edit" />}>
                  <Route path="bookings/:id/edit" element={<EditBookingScreen />} />
                </Route>
                <Route path="bookings/:id" element={<BookingDetailScreen />} />
                <Route path="guests" element={<GuestsScreen />} />
                <Route path="guests/:id" element={<GuestDetailScreen />} />
                <Route path="housekeeping" element={<HousekeepingScreen />} />
                <Route path="cash" element={<CashScreen />} />
                <Route element={<RequireAbility ability="reports.view" />}>
                  <Route path="reports/daily" element={<DailyReportScreen />} />
                </Route>
                <Route element={<RequireAbility ability="settings.manage" />}>
                  <Route path="settings/*" element={<SettingsScreen />} />
                </Route>
                <Route path="more" element={<MoreScreen />} />
                <Route path="*" element={<NotFoundScreen />} />
              </Route>
              {/* Print views: no shell chrome, the document is the whole page */}
              <Route
                path="bookings/:id/receipt"
                element={
                  <ScreenErrorBoundary>
                    <ReceiptScreen />
                  </ScreenErrorBoundary>
                }
              />
              <Route
                path="bookings/:id/registration"
                element={
                  <ScreenErrorBoundary>
                    <RegistrationCardScreen />
                  </ScreenErrorBoundary>
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
