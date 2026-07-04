interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  children: string;
}

const badgeVariants = {
  default: "bg-surface-hover text-text-secondary border-border",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary",
};

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeVariants[variant]}`}
    >
      {children}
    </span>
  );
}
