export default function SplashLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="splash-screen-root flex min-h-0 w-full justify-center">
      {children}
    </div>
  );
}
