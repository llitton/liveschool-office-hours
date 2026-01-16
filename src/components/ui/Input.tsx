import { inputStyles } from '@/lib/design-tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function Input({
  label,
  helper,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className={inputStyles.label}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={error ? inputStyles.error : inputStyles.base}
        {...props}
      />
      {error && <p className={inputStyles.errorText}>{error}</p>}
      {helper && !error && <p className={inputStyles.helper}>{helper}</p>}
    </div>
  );
}

// Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function Textarea({
  label,
  helper,
  error,
  className = '',
  id,
  rows = 4,
  ...props
}: TextareaProps) {
  const inputId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className={inputStyles.label}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`${error ? inputStyles.error : inputStyles.base} resize-none`}
        {...props}
      />
      {error && <p className={inputStyles.errorText}>{error}</p>}
      {helper && !error && <p className={inputStyles.helper}>{helper}</p>}
    </div>
  );
}

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  helper,
  error,
  options,
  className = '',
  id,
  ...props
}: SelectProps) {
  const inputId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className={inputStyles.label}>
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={error ? inputStyles.error : inputStyles.base}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className={inputStyles.errorText}>{error}</p>}
      {helper && !error && <p className={inputStyles.helper}>{helper}</p>}
    </div>
  );
}

// Form field wrapper with label
interface FormFieldProps {
  label: string;
  htmlFor?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  helper,
  error,
  required,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={inputStyles.label}>
        {label}
        {required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className={inputStyles.errorText}>{error}</p>}
      {helper && !error && <p className={inputStyles.helper}>{helper}</p>}
    </div>
  );
}
