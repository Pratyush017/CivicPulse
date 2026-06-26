import { redirect } from 'next/navigation';

export default function Home() {
  // Instantly skip the boilerplate and send judges straight to the dashboard
  redirect('/dashboard');
}