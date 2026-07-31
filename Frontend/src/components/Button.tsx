import type { FC, ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'yellow';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm focus:ring-blue-500',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 focus:ring-slate-500',
    outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700 focus:ring-slate-500',
    yellow: 'bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-sm focus:ring-amber-400',
  };

  const sizes = {
    default: 'px-6 py-2.5 text-sm',
    large: 'px-8 py-3.5 text-base',
  };

  const currentVariant = variants[variant] || variants.primary;
  const isLarge = variant === 'yellow' || variant === 'outline' ? sizes.large : sizes.default;
  
  return (
    <button
      className={`${baseStyles} ${currentVariant} ${isLarge} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
