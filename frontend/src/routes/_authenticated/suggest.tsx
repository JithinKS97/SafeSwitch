import { createFileRoute } from '@tanstack/react-router'
import { SuggestPage } from '../../modules/suggest'

export const Route = createFileRoute('/_authenticated/suggest')({
  component: SuggestPage,
})
