import './globals.css';

export const metadata = {
  title: 'Quizzy',
  description: 'Cryptocurrency Knowledge Challenge',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
