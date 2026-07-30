import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import { env } from '@/lib/env';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: 'Golgolion',
  description: '던전앤파이터 골고라이언 시세 정보',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
