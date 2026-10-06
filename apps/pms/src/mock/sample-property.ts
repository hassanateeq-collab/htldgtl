/**
 * Sample (demo) property — seeded from Booking.com for development.
 * Source: "Central Residence by Paramount Hospitality", Karachi
 *   booking.com/hotel/pk/central-residence-by-paramount-hospitality.html (read 2026-10-06)
 *
 * Drives the mock screens now; becomes the demo tenant's SQL seed once the
 * database is up (migration 0001 + supabase/seed/). Facts (name, address, room
 * types, bed configs, sizes, nightly rates) are from the listing.
 *
 * ASSUMPTION: room UNIT counts and numbers are invented — Booking.com shows
 * availability, not total inventory. Adjust `sampleRooms` to match reality.
 */

export type HousekeepingStatus = 'clean' | 'dirty' | 'inspected' | 'out_of_order'

export interface SampleTenant {
  id: string
  name: string
  slug: string
}

export interface SampleProperty {
  id: string
  tenantId: string
  name: string
  addressLine: string
  city: string
  postalCode: string
  country: string
  timezone: string
  currency: string
  starRating: number
  checkInFrom: string // 24h HH:mm, property-local
  checkOutUntil: string
  amenities: string[]
}

export interface SampleRoomType {
  id: string
  propertyId: string
  name: string
  bedConfig: string
  sizeSqm: number
  baseOccupancy: number
  maxOccupancy: number
  baseRatePkr: number // standard nightly rate (pay-at-property, 2 guests)
  singleRatePkr?: number // single-occupancy rate where listed
  amenities: string[]
}

export interface SampleRoom {
  id: string
  propertyId: string
  roomTypeId: string
  label: string // room number
  floor: number
  housekeepingStatus: HousekeepingStatus
}

export const sampleTenant: SampleTenant = {
  id: 'demo-paramount',
  name: 'Paramount Hospitality',
  slug: 'paramount',
}

export const sampleProperty: SampleProperty = {
  id: 'prop-central-residence',
  tenantId: sampleTenant.id,
  name: 'Central Residence',
  addressLine: 'No. 17 Amir Khusro Road',
  city: 'Karachi',
  postalCode: '75300',
  country: 'Pakistan',
  timezone: 'Asia/Karachi',
  currency: 'PKR',
  starRating: 3,
  checkInFrom: '14:00',
  checkOutUntil: '12:00',
  amenities: [
    'Free WiFi',
    'Air conditioning',
    'Free parking',
    '24-hour front desk',
    'Room service',
    'Airport shuttle',
    'Terrace',
    'Elevator',
    'Buffet breakfast',
    'Non-smoking rooms',
  ],
}

const ROOM_AMENITIES = [
  'Air conditioning',
  'Attached bathroom',
  'Flat-screen TV',
  'Free WiFi',
  'Work desk',
]

export const sampleRoomTypes: SampleRoomType[] = [
  {
    id: 'rt-twin',
    propertyId: sampleProperty.id,
    name: 'Twin Room',
    bedConfig: '2 twin beds',
    sizeSqm: 20,
    baseOccupancy: 2,
    maxOccupancy: 2,
    baseRatePkr: 15000,
    singleRatePkr: 13500,
    amenities: ROOM_AMENITIES,
  },
  {
    id: 'rt-queen',
    propertyId: sampleProperty.id,
    name: 'Queen Room',
    bedConfig: '1 queen bed',
    sizeSqm: 20,
    baseOccupancy: 2,
    maxOccupancy: 2,
    baseRatePkr: 15000,
    singleRatePkr: 13500,
    amenities: ROOM_AMENITIES,
  },
  {
    id: 'rt-deluxe-king',
    propertyId: sampleProperty.id,
    name: 'Deluxe King Room',
    bedConfig: '1 king bed',
    sizeSqm: 30,
    baseOccupancy: 2,
    maxOccupancy: 2,
    baseRatePkr: 17000,
    singleRatePkr: 15500,
    amenities: ROOM_AMENITIES,
  },
  {
    id: 'rt-deluxe-family',
    propertyId: sampleProperty.id,
    name: 'Deluxe Family Room',
    bedConfig: '1 twin bed and 1 queen bed',
    sizeSqm: 30,
    baseOccupancy: 2,
    maxOccupancy: 3,
    baseRatePkr: 18500,
    singleRatePkr: 17500,
    amenities: ROOM_AMENITIES,
  },
]

export const sampleRooms: SampleRoom[] = [
  // Floor 1 — Twin Room
  { id: 'room-101', propertyId: sampleProperty.id, roomTypeId: 'rt-twin', label: '101', floor: 1, housekeepingStatus: 'clean' },
  { id: 'room-102', propertyId: sampleProperty.id, roomTypeId: 'rt-twin', label: '102', floor: 1, housekeepingStatus: 'dirty' },
  { id: 'room-103', propertyId: sampleProperty.id, roomTypeId: 'rt-twin', label: '103', floor: 1, housekeepingStatus: 'clean' },
  { id: 'room-104', propertyId: sampleProperty.id, roomTypeId: 'rt-twin', label: '104', floor: 1, housekeepingStatus: 'inspected' },
  // Floor 2 — Queen Room
  { id: 'room-201', propertyId: sampleProperty.id, roomTypeId: 'rt-queen', label: '201', floor: 2, housekeepingStatus: 'clean' },
  { id: 'room-202', propertyId: sampleProperty.id, roomTypeId: 'rt-queen', label: '202', floor: 2, housekeepingStatus: 'dirty' },
  { id: 'room-203', propertyId: sampleProperty.id, roomTypeId: 'rt-queen', label: '203', floor: 2, housekeepingStatus: 'clean' },
  { id: 'room-204', propertyId: sampleProperty.id, roomTypeId: 'rt-queen', label: '204', floor: 2, housekeepingStatus: 'out_of_order' },
  // Floor 3 — Deluxe King Room
  { id: 'room-301', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-king', label: '301', floor: 3, housekeepingStatus: 'clean' },
  { id: 'room-302', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-king', label: '302', floor: 3, housekeepingStatus: 'clean' },
  { id: 'room-303', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-king', label: '303', floor: 3, housekeepingStatus: 'dirty' },
  { id: 'room-304', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-king', label: '304', floor: 3, housekeepingStatus: 'clean' },
  { id: 'room-305', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-king', label: '305', floor: 3, housekeepingStatus: 'inspected' },
  { id: 'room-306', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-king', label: '306', floor: 3, housekeepingStatus: 'clean' },
  // Floor 4 — Deluxe Family Room
  { id: 'room-401', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-family', label: '401', floor: 4, housekeepingStatus: 'clean' },
  { id: 'room-402', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-family', label: '402', floor: 4, housekeepingStatus: 'dirty' },
  { id: 'room-403', propertyId: sampleProperty.id, roomTypeId: 'rt-deluxe-family', label: '403', floor: 4, housekeepingStatus: 'clean' },
]
