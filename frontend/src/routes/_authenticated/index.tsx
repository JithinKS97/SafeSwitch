import { createFileRoute } from '@tanstack/react-router'
import { PositionsPage } from '../../modules/positions'

export const Route = createFileRoute('/_authenticated/')({
  component: PositionsPage,
})
