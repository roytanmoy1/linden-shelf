import { useEffect, useRef, type ComponentProps } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_NAME = 'Linden Shelf';

type HeadingProps = Pick<ComponentProps<'h1'>, 'id' | 'className'> & { children: string };

export function PageHeading({ children, ...attributes }: HeadingProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { key } = useLocation();
  useEffect(() => {
    document.title = `${children} | ${SITE_NAME}`;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [children, key]);
  return <h1 {...attributes} ref={heading} tabIndex={-1}>{children}</h1>;
}
