import "./globals.css";

export const metadata = {
  title: "TTB Label Verification",
  description:
    "AI-powered alcohol beverage label compliance checker for the Alcohol and Tobacco Tax and Trade Bureau.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
