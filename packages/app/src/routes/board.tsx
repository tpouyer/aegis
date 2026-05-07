import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/board')({
  component: BoardLayout,
})

function BoardLayout() {
  return <Outlet />
}
