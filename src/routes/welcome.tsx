import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/welcome')({
  staticData: { sitemap: false },
  beforeLoad: () => { throw redirect({ to: '/', statusCode: 301 }); },
});
