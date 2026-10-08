import "./globals.css";
import "flatpickr/dist/flatpickr.min.css";
import Script from "next/script";
import InactivityTimeout from "./components/InactivityTimeout";
import MobileKeyboardViewportHelper from "./components/MobileKeyboardViewportHelper";

import { Toaster } from "@/components/ui/toast";

export const metadata = {
  title: "PCC Home Suite Home | Koronadal City",
  description: "PCC Home Suite Home offers comfortable, affordable, and well-kept rooms in Koronadal City.",
  icons: {
    icon: [
      { url: '/assets/images/logo.jpg', type: 'image/jpeg' },
      { url: '/icon.jpg', type: 'image/jpeg' }
    ],
    shortcut: ['/assets/images/logo.jpg'],
    apple: [
      { url: '/assets/images/logo.jpg' }
    ]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  interactiveWidget: "resizes-content" // Crucial for mobile virtual keyboards to resize viewport
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Toaster />
        <InactivityTimeout />
        <MobileKeyboardViewportHelper />
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
