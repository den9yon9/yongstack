import type { ReactNode } from 'react'

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-slate-600">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
