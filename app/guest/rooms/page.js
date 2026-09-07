import { redirect } from 'next/navigation';

export default function GuestRoomsPage() {
  redirect('/guest/dashboard?tab=rooms');
}
