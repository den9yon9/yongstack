import type { ReactNode } from 'react'

import { EmptyState } from './layout'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right'
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  empty,
  className = '',
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  className?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                加载中…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty ?? <EmptyState />}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : ''} ${
                      column.className ?? ''
                    }`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}
