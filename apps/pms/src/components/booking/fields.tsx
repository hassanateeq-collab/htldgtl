import { PAYMENT_METHODS, t, type PaymentMethod } from '@hotel-digital/shared'
import { Segmented } from '@/components/ui/segmented'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { idTypeLabel, methodLabel } from '@/lib/labels'
import type { IdType } from '@/data/types'

export const ID_TYPES: IdType[] = ['cnic', 'nicop', 'poc', 'passport', 'other']

export function PaymentMethodChips({ value, onChange }: { value: PaymentMethod | null; onChange: (m: PaymentMethod) => void }) {
  return (
    <Segmented
      ariaLabel={t('folio.method')}
      value={value}
      onChange={onChange}
      wrap
      options={PAYMENT_METHODS.map((m) => ({ value: m, label: methodLabel(m) }))}
    />
  )
}

interface IdFieldsProps {
  idType: IdType
  idNumber: string
  onTypeChange: (t: IdType) => void
  onNumberChange: (n: string) => void
  error?: string | null
  required?: boolean
}

/** Document type + number, with the CNIC mask applied as the receptionist types. */
export function IdFields({ idType, idNumber, onTypeChange, onNumberChange, error, required }: IdFieldsProps) {
  const onNumber = (raw: string) => {
    if (idType !== 'cnic') return onNumberChange(raw)
    const d = raw.replace(/\D/g, '').slice(0, 13)
    let out = d
    if (d.length > 5) out = `${d.slice(0, 5)}-${d.slice(5)}`
    if (d.length > 12) out = `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
    onNumberChange(out)
  }
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
      <Field label={t('checkin.idType')}>
        <Select value={idType} onChange={(e) => onTypeChange(e.target.value as IdType)}>
          {ID_TYPES.map((v) => (
            <option key={v} value={v}>
              {idTypeLabel(v)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('checkin.idNumber')} required={required} error={error}>
        <Input
          value={idNumber}
          onChange={(e) => onNumber(e.target.value)}
          inputMode={idType === 'cnic' ? 'numeric' : 'text'}
          placeholder={idType === 'cnic' ? '42101-1234567-1' : ''}
          autoCapitalize="characters"
          className="tnum"
        />
      </Field>
    </div>
  )
}
