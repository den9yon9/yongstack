import { Link, RouterProvider, createRouter } from '@tanstack/react-router'

import { Button, buttonVariants } from '@yongstack/ui/components/button'
import { Spinner } from '@yongstack/ui/components/spinner'

import { routeTree } from './routeTree.gen'
import './styles.css'

const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error, reset }) => (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-destructive">页面出错了：{error.message}</p>
      <Button onClick={() => reset()}>重试</Button>
    </div>
  ),
  defaultNotFoundComponent: () => (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">页面不存在</p>
      <Link to="/" className={buttonVariants()}>
        返回首页
      </Link>
    </div>
  ),
  defaultPendingComponent: () => (
    <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      加载中…
    </div>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <RouterProvider router={router} />
}
