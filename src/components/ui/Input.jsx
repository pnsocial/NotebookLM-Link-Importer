export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 ${className}`}
      {...props}
    />
  )
}
