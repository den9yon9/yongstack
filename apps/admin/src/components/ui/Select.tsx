import { forwardRef } from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className = "", id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-text"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`block h-9 w-full rounded-lg border bg-surface px-3 text-sm text-text transition-colors focus:outline-none focus:ring-2 ${
            error
              ? "border-danger focus:ring-danger/50"
              : "border-border focus:ring-primary/50"
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
