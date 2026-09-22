/* oxlint-disable next/no-img-element -- Installed assets require no server image optimizer. */
import type { ImgHTMLAttributes } from 'react';
export default function Image({
  unoptimized: _unoptimized,
  priority,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  unoptimized?: boolean;
  priority?: boolean;
}) {
  return (
    <img
      {...props}
      alt={props.alt ?? ''}
      loading={priority ? 'eager' : (props.loading ?? 'lazy')}
    />
  );
}
