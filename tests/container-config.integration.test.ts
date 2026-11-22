import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
interface Service {
  ports?: string[];
  environment?: Record<string, string>;
  security_opt: string[];
  cap_drop: string[];
  read_only: boolean;
  user?: string;
  healthcheck?: { test: string[] };
  build?: { context: string; dockerfile: string };
  image?: string;
}
const compose = () => parse(read('compose.yaml')) as { services: Record<'web' | 'api' | 'mailpit', Service> };
const nginx = read('services/catalogue-web/nginx.conf');

describe('container configuration (static checks, not a Docker runtime test)', () => {
  it('exposes only web and inbox on loopback with exactly three services', () => {
    const { services } = compose();
    expect(Object.keys(services).sort()).toEqual(['api', 'mailpit', 'web']);
    expect(services.web.ports).toEqual(['127.0.0.1:${WEB_PORT:-3000}:8080']);
    expect(services.mailpit.ports).toEqual(['127.0.0.1:${MAILPIT_HTTP_PORT:-8025}:8025']);
    expect(services.api.ports).toBeUndefined();
    expect(services.mailpit.ports?.some((port) => port.endsWith(':1025'))).toBe(false);
  });

  it('opts into one protected proxy hop only in Compose and keeps origins consistent with ports', () => {
    const { api } = compose().services;
    expect(api.environment).toMatchObject({
      TRUST_INGRESS_PROXY: 'true', HOST: '0.0.0.0', PORT: '3001', SMTP_HOST: 'mailpit', SMTP_PORT: '1025',
      ALLOWED_ORIGINS: 'http://localhost:${WEB_PORT:-3000},http://127.0.0.1:${WEB_PORT:-3000}',
    });
    expect(read('.env.example')).toContain('TRUST_INGRESS_PROXY=false');
    expect(read('.env.example')).toContain('SMTP_HOST=127.0.0.1');
  });

  it('overwrites forwarding headers and keeps API errors outside the SPA fallback', () => {
    expect(nginx).toContain('location ~ ^/api(?:/|$)');
    expect(nginx).toContain('proxy_pass http://api:3001;');
    expect(nginx).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
    expect(nginx).toContain('proxy_set_header Forwarded "";');
    expect(nginx).not.toContain('$proxy_add_x_forwarded_for');
    expect(nginx).toContain('proxy_intercept_errors off;');
    expect(nginx).toContain('try_files $uri $uri/ /index.html;');
    expect(nginx).not.toMatch(/error_page\s+\d+\s+.*index\.html/);
    expect(nginx).toContain('access_log off;');
    expect(nginx).toContain('expires -1;');
    expect(nginx).not.toContain('add_header Cache-Control');
  });

  it('prevents framing the catalogue and enquiry form', () => {
    expect(nginx).toMatch(/add_header Content-Security-Policy "[^"]*frame-ancestors 'none'[^"]*" always;/);
  });

  it('negotiates gzip only for public static bundles', () => {
    const assets = nginx.match(/location\s+\/assets\/\s*\{[^}]*\}/)?.[0] ?? '';
    expect(assets).toContain('gzip on;');
    expect(assets).toContain('gzip_vary on;');
    expect(assets).toContain('gzip_types text/css application/javascript text/javascript;');
    expect(nginx.replace(assets, '')).not.toMatch(/\bgzip\s+on;/);
  });

  it('uses non-root multistage runtimes, process-only healthchecks and restricted services', () => {
    const { services } = compose();
    for (const service of Object.values(services)) {
      expect(service.read_only).toBe(true);
      expect(service.cap_drop).toEqual(['ALL']);
      expect(service.security_opt).toEqual(['no-new-privileges:true']);
    }
    expect(services.mailpit.user).not.toBe('0:0');
    expect(services.mailpit.image).toMatch(/^axllent\/mailpit:v\d+\.\d+\.\d+$/);
    expect(services.mailpit.healthcheck?.test).toEqual(['CMD', '/mailpit', 'readyz']);
    for (const service of ['api', 'web'] as const) {
      const dockerfile = read(`services/catalogue-${service}/Dockerfile`);
      expect(dockerfile.match(/^FROM /gm)?.length).toBeGreaterThanOrEqual(2);
      expect(dockerfile).toMatch(/^FROM node:24\./m);
      expect(dockerfile).toMatch(/^USER (node|101:101)$/m);
      expect(dockerfile).toContain('HEALTHCHECK');
      expect(dockerfile).not.toMatch(/HEALTHCHECK[^\n]*(fakestore|enquiries|smtp)/i);
    }
  });

  it('excludes assessment, private configuration, tooling and generated files from image contexts', () => {
    const ignore = read('.dockerignore').split(/\r?\n/);
    for (const pattern of ['**/*.pdf', '**/.env', '**/.env.*', '**/.git', '**/.azure', '**/.tools', '**/node_modules', '**/dist', '**/coverage']) {
      expect(ignore).toContain(pattern);
    }
  });

  it('limits CI to read-only checks with no deployment or publishing commands', () => {
    const workflow = parse(read('.github/workflows/ci.yml')) as {
      permissions: Record<string, string>;
      jobs: { checks: { steps: { run?: string }[] } };
    };
    expect(workflow.permissions).toEqual({ contents: 'read' });
    const commands = workflow.jobs.checks.steps.flatMap((step) => step.run ? [step.run] : []);
    expect(commands).toEqual([
      'npm ci', 'npm run test:coverage', 'npm run lint', 'npm run typecheck',
      'npm run build', 'node tests/server-smoke.mjs', 'npm audit --audit-level=high',
    ]);
  });

  it('exercises the reviewer stack, the browser-to-inbox journey and cleanup on pull requests', () => {
    const workflow = parse(read('.github/workflows/ci.yml')) as {
      jobs: { reviewer?: { steps: { run?: string; if?: string }[] } };
    };
    const steps = workflow.jobs.reviewer?.steps ?? [];
    const commands = steps.map((step) => step.run).join('\n');
    expect(commands).toContain('docker compose up --build --wait');
    expect(commands).toContain('npm run test:acceptance');
    expect(commands).toContain('docker compose stop api');
    expect(steps).toContainEqual(expect.objectContaining({ if: 'always()', run: 'docker compose down' }));
  });
});