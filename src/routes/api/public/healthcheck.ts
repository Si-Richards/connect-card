import { createFileRoute } from '@tanstack/react-router';

type RouteCheck = {
  name: string;
  modulePath: string;
  ok: boolean;
  error?: string;
};

async function checkRoute(name: string, loader: () => Promise<unknown>, modulePath: string): Promise<RouteCheck> {
  try {
    const mod = (await loader()) as { Route?: unknown };
    if (!mod || !mod.Route) {
      return { name, modulePath, ok: false, error: 'Module loaded but no Route export found' };
    }
    return { name, modulePath, ok: true };
  } catch (err) {
    return {
      name,
      modulePath,
      ok: false,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export const Route = createFileRoute('/api/public/healthcheck')({
  server: {
    handlers: {
      GET: async () => {
        const checks = await Promise.all([
          checkRoute('wallet', () => import('./wallet.$slug'), 'src/routes/api/public/wallet.$slug.ts'),
          checkRoute('qr', () => import('./qr.$slug'), 'src/routes/api/public/qr.$slug.ts'),
          checkRoute('vcard', () => import('./vcard.$slug'), 'src/routes/api/public/vcard.$slug.ts'),
        ]);

        const allOk = checks.every((c) => c.ok);
        return new Response(
          JSON.stringify(
            {
              status: allOk ? 'ok' : 'error',
              timestamp: new Date().toISOString(),
              checks,
            },
            null,
            2,
          ),
          {
            status: allOk ? 200 : 503,
            headers: { 'content-type': 'application/json' },
          },
        );
      },
    },
  },
});
