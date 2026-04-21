import { Redirect } from 'expo-router';

export default function TabIndex() {
  // Since the premium landing/splash experience is now at the root index.tsx,
  // we redirect any navigation here to the dashboard or root hub.
  return <Redirect href="/dashboard" />;
}
