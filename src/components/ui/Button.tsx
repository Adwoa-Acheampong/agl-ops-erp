import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'primaryLg' | 'dark' | 'ghost' | 'outline' | 'chip';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClass: Record<Variant, string> = {
  primary:   'btn-primary',
  primaryLg: 'btn-primary-lg',
  dark:      'btn-dark',
  ghost:     'btn-ghost',
  outline:   'btn-outline',
  chip:      'btn-chip',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, ...rest }, ref) => (
    <button ref={ref} className={cn(variantClass[variant], className)} {...rest} />
  )
);
Button.displayName = 'Button';
