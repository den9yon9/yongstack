import type { ReactNode } from 'react'

export function FileUpload({
  label = '选择文件',
  accept,
  disabled = false,
  onSelect,
}: {
  label?: ReactNode
  accept?: string
  disabled?: boolean
  onSelect: (file: File) => void
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40 ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <span className="font-medium text-slate-700">{label}</span>
      <span className="text-xs text-slate-400">点击选择文件</span>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onSelect(file)
          event.target.value = ''
        }}
      />
    </label>
  )
}
