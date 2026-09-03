
import './globals.css';
import { Header } from '@/app/components/Header';

export const metadata = {
  title: 'Frontier - Rogue AI Incident Tracker',
  description: 'Tracking autonomous and unaligned actions from frontier AI models.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col">
        <main className="flex-1 container mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

