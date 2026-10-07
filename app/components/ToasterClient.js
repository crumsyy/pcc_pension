'use client';

import { Toaster as Sonner } from 'sonner';
import 'sonner/dist/styles.css';

export default function ToasterClient() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={4000}
      style={{ zIndex: 999999999 }}
    />
  );
}
