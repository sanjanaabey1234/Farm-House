import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chicken Wholesale Books',
  description: 'Multi-client bookkeeping for chicken wholesale businesses: sales, purchases, payments, wages, expenses, reports and full Excel export.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
