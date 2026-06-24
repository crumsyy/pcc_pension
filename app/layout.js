import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "PCC Home Suite Home | Koronadal City",
  description: "PCC Home Suite Home offers comfortable, affordable, and well-kept rooms in Koronadal City.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        
        {/* Bootstrap 5 JS Bundle CDN */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
