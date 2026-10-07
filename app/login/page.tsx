import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Sign in · Chicken Wholesale Books' };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
