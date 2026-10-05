import Image from 'next/image';

import { cn } from '@/lib/utils';

interface BrandMarkProps {
  alt?: string;
  className?: string;
  width: number;
  height: number;
  priority?: boolean;
}

export function BrandMark({
  alt = '',
  className,
  width,
  height,
  priority,
}: BrandMarkProps) {
  return (
    <>
      <Image
        src="/adolf-v3-mark.png"
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn('brand-mark-dark', className)}
      />
      <Image
        src="/adolf-v3-mark-light.png"
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn('brand-mark-light', className)}
      />
    </>
  );
}