import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { getLastSlug } from '@/auth/storage'

const inputClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** /login — asks for the hotel code, then goes to that hotel's login page. */
export function LoginEntryScreen() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState(getLastSlug() ?? '')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const clean = slug.trim().toLowerCase()
    if (clean) navigate(`/t/${clean}/login`)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Hotel Digital</p>
      <h1 className="mt-1 text-2xl font-semibold">{t('auth.hotelCode')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('auth.hotelCodeHint')}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          className={inputClass}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="paramount"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
        />
        <Button type="submit" className="w-full" size="lg">
          {t('auth.continue')}
        </Button>
      </form>
    </div>
  )
}
