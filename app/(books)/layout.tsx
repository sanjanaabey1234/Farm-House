import { BooksProvider } from '@/components/BooksProvider';
import { Shell } from '@/components/Shell';

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return (
    <BooksProvider>
      <Shell>{children}</Shell>
    </BooksProvider>
  );
}
