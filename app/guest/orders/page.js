import { redirect } from 'next/navigation';

export default function GuestOrdersPage() {
  redirect('/guest/dashboard?tab=orders');
}
