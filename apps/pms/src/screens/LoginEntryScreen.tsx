import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { getLastSlug } from '@/auth/storage'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/** /login — asks for the hotel code, then goes to that hotel's login page. */
export default function LoginEntryScreen() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState(getLastSlug() ?? '')
  useDocumentTitle(t('auth.hotelCode'))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (clean) navigate(`/t/${clean}/login`)
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t('auth.brand')}</p>
      <h1 className="mt-2 text-2xl font-semibold">{t('auth.hotelCode')}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label={t('auth.hotelCode')} hint={t('auth.hotelCodeHint')} hideLabel>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="paramount"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="organization"
            autoFocus
            className="text-lg"
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" disabled={!slug.trim()}>
          {t('auth.continue')}
        </Button>
      </form>
    </main>
  )
}
