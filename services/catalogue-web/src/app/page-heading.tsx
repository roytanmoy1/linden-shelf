import { useEffect, useRef, type ComponentProps, type RefObject } from 'react';
import { useLocation, useNavigationType, useOutletContext } from 'react-router-dom';

export const SITE_NAME = 'Linden Shelf';
export type ProductReturnTarget = { entryKey: string; path: string };

type HeadingProps = Pick<ComponentProps<'h1'>, 'id' | 'className'> & { children: string };

export function PageHeading({ children, ...attributes }: HeadingProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { key, hash } = useLocation();
  const navigation = useNavigationType();
  const lastProduct = useOutletContext<RefObject<ProductReturnTarget | null> | null>();
  useEffect(() => {
    document.title = `${children} | ${SITE_NAME}`;
    if (hash) return;
    const from = lastProduct?.current;
    const card = navigation === 'POP' && from && from.entryKey === key
      ? Array.from(document.querySelectorAll<HTMLAnchorElement>('main .card-link')).find((link) => link.pathname === from.path) : undefined;
    (card ?? heading.current)?.focus({ preventScroll: true });
  }, [children, key, hash, navigation, lastProduct]);
  return <h1 {...attributes} ref={heading} tabIndex={-1}>{children}</h1>;
}
