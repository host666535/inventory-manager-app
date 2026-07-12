import { useCountUp } from '@/hooks/useAnimations';

type Props = {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
};

export default function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  className,
  suffix = '',
  prefix = '',
}: Props) {
  const current = useCountUp(value, duration);
  const display = current.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
