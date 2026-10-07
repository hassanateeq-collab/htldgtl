import { Link } from 'react-router-dom'
import { t } from '@hotel-digital/shared'
import { Button } from '@/components/ui/button'
import { Page, PageHeader } from '@/components/patterns/Page'

export default function NotFoundScreen() {
  return (
    <Page width="md">
      <PageHeader title={t('shell.notFound')} back="/today" />
      <div className="py-10 text-center">
        <p className="text-base text-muted-foreground">{t('shell.notFound')}</p>
        <Button className="mt-4" asChild>
          <Link to="/today">{t('shell.goHome')}</Link>
        </Button>
      </div>
    </Page>
  )
}
