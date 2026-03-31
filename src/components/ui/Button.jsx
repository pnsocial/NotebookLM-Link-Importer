export function Button({
  children,
  variant = 'secondary',
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
  const variants = {
    primary:
      'bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 active:bg-black',
    secondary:
      'bg-white text-gray-700 border border-[#E5E7EB] hover:bg-gray-50 active:bg-gray-100',
    muted:
      'bg-[#F3F4F6] text-gray-900 border border-transparent hover:bg-[#E5E7EB] active:bg-[#E5E7EB]',
    outline:
      'bg-white text-gray-900 border border-[#E5E7EB] hover:bg-gray-50 active:bg-gray-100',
    ghost: 'border border-transparent text-gray-600 hover:bg-gray-50',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant] ?? variants.secondary} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
