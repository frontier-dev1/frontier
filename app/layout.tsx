import './globals.css';

export const metadata = {
  title: 'Frontier - Rogue AI Incident Tracker',
  description: 'Tracking autonomous and unaligned actions from frontier AI models.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}