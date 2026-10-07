import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Create account · Chicken Wholesale Books' };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
