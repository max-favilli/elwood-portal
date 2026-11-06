# Elwood Portal

Management UI for Elwood pipelines, built with Next.js and Monaco.

## Local workspace

Use Node.js 22+ and the .NET SDK selected by the backend's `global.json`.
Clone the repositories into sibling folders:

```text
workspace/
├── elwood/
└── elwood-portal/
```

From `elwood-portal`, install dependencies and start both applications:

```sh
npm ci
npm run dev:all
```

The portal runs at http://localhost:3000 and the Runtime API at
http://localhost:5000. Ctrl+C stops both process trees. The API runs from its
project directory so its pipeline and local secret paths resolve correctly.
`start-dev.ps1` and `start-dev.sh` invoke the same launcher and can be called
from another working directory. Keep ports 3000 and 5000 free.

For a separately hosted API, set `NEXT_PUBLIC_API_URL` in `.env.local` and
start just the portal with `npm run dev`.

## Management access and deployment

`dev:all` creates a loopback-only management token and prints its file path. Paste that file's contents into the portal's management sign-in screen. The token stays in this browser tab's session storage until sign-out or tab closure. The playground does not require sign-in. A separately started API denies management access until identities are configured; there is no anonymous management fallback.

Save draft and Validate never publish a pipeline. Test draft runs the current editor snapshot synchronously, with an explicit choice between real systems and mock fixtures. Save the draft, then use **Deploy** to activate that exact revision. Conflicting edits return a reload/reconcile error. Existing filesystem pipelines remain live and display **Migrate existing deployment** before draft editing is enabled. Execution history shows the exact revision used.

For shared credentials, permission scopes, secret grants and the legacy migration procedure, see the backend's [management and deployment guide](https://github.com/max-favilli/elwood/blob/main/docs/management-and-deployment.md). Native Azure catalogs, item inspection, selected retry and acknowledged replay are available in the explicitly enabled distributed runtime.

## Deldo and Eagle pilot installation

Use the compatible backend release and operating limits in the [versioned pilot handoff](https://github.com/max-favilli/elwood/blob/main/docs/pilot-handoff.md). Provisioning, hosting costs and business-system acceptance belong to the consumer project. `dev:all` starts a filesystem development runtime; it does not provision Azure or enable the cloud distributed profile. Draft real/mock testing remains available locally.

For a deployed runtime, set `NEXT_PUBLIC_API_URL` to its HTTPS origin **before** `npm run build`; the browser bundle embeds this value. Run `npm ci`, `npm run build` and `npm start` on the consumer's approved Node.js 22+ host. Configure HTTPS in front of the portal and its exact origin in the runtime's CORS allowlist. Do not put management tokens or connector secrets in `NEXT_PUBLIC_*` settings. Sign in with a scoped runtime identity and verify draft testing, execution/item inspection, selected retry and replay permissions before granting team access.

The backend handoff includes separate installation smoke commands for Deldo and Eagle. A successful portal build does not establish runtime readiness, secret access, retention health or safe SAP/SQL retries.

## DSL alignment and validation

The portal pins `@elwood-lang/core` to 0.7.25, matching the sibling backend
baseline. It uses the published package, so production builds do not depend on
the sibling checkout. When upgrading the DSL, update the dependency and lockfile
together, then refresh and verify the bundled examples:

```sh
npm run examples:sync
npm test
npm run build
npm run lint
```

Only `examples:sync` requires the sibling repository. The gallery preserves
fixture bindings and wraps CSV/XML/text inputs as JSON strings for the JSON
input editor. The example suite checks the installed DSL against their expected
outputs. For the two crypto examples, it instead verifies the unsupported-runtime
diagnostic: `hash()` and `rsaSign()` currently depend on CommonJS `require` and
are unavailable in browsers and native Node ESM. The other 110 examples are
checked against their expected outputs.

The run panel's test execution flag labels execution history; it is not a dry
run and can still call configured destinations.

## Next.js development

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local draft tests (M3)

Open a draft, choose **Test draft**, then explicitly select **Mocks** or **Real systems** under **Connectors**. Run stays disabled until a mode is selected. Mock mode offers **Replace fixtures with template** for the current editor snapshot. Edit response bodies and optional `expectBody` assertions, enter the trigger JSON and run. **Steps and data** shows transformed data, diagnostics and connector calls; the same inspection is available under **Executions**.

Both sync and async definitions run synchronously for local tests without saving or deploying. Real tests use the host's test secret grants and can change external systems. Mock runs cannot contact real systems or access secrets. M5 connector support includes HTTP Basic/OAuth2, SQL Server procedures and Azure Blob reads/writes. M4 retry/resume/replay applies to deployed durable executions. Local supplied-trigger tests do not subscribe to RabbitMQ or Event Grid. See the backend's `docs/local-testing.md` for the JSON contract and API details.

### Public HTTP sample pipelines

Choose **New Pipeline → Start from** for Order echo, Cart creation and delivery, HTTP 503 failure or HTTP timeout. Each creates a draft with a unique name/endpoint and includes synthetic input and mock fixtures in **Test draft**. Select **Mocks** or **Real systems** explicitly. The error/timeout examples intentionally fail; their expected outcomes are shown in the panel.

The cart example defaults to Postman Echo for delivery. Replace its output URL with your own Webhook.site receiving URL to inspect delivered requests there. See the backend's `docs/examples/public-http/README.md` for setup, limitations and verification. `npm run samples:sync` regenerates the checked-in sample bundle from the sibling backend repo; standalone portal clones use that bundle directly.

### M5 connector samples

The same **Start from** gallery now includes authenticated orders, product SQL/SAP and Deldo supplier imports. All three run with bundled mocks and no credentials. Real tests require host-owned Test secret/identity grants; deployment uses separate Run grants. **Steps and data → Connector calls** shows SQL/Blob operation metadata and results/receipts as well as HTTP headers/bodies. See the backend's `docs/connectors.md` and `docs/examples/connectors/README.md` for prerequisites and contracts. The Deldo example includes its `.elwood` scripts and returns five offers/six rejected rows from synthetic CSV.

M5 visual verification (7 October 2026): the Deldo mock flow completed through the portal; Blob metadata and SQL/Blob receipts were expanded, and the SQL receipt was reopened from execution history. See the backend’s `docs/implementation-plan.md` for the complete M5 closeout and review scope. Native cloud hosting and enforced output-blob retention remain M6 requirements.


## Portal verification

Use Node 22 (matching CI), then run `npm ci`, `npm test`, `npm run test:components`, `npm run lint`, `npx tsc --noEmit` and `npm run build`.

`npm test` passes 120 tests: 112 DSL example fixtures and eight gallery/helper/API/sample checks (the separate live Azure browser test is opt-in and skipped locally). `npm run test:components` now passes **24** Vitest/React Testing Library tests. They cover authoring, real/mock selection, exact unsaved snapshots, save-before-deploy, conflict display, permissions, execution inspection/recovery acknowledgements, keeping saved tokens on non-401 failures, terminal polling, distributed item selection/inspection/retry commands, replay capability gating/lost responses and partial stage counts. Browser-dependent editor boundaries, routing/session context and network calls are mocked. These are component tests, not a new browser walkthrough.

The earlier dependency warning about Next.js 16.2.3/Axios was historical: the second-review package upgraded Next to >=16.4.0 and Axios to >=1.20.0. Re-run `npm audit` at release time; an old audit is not a current security guarantee.

On 3 November 2026, the compatible patch refresh resolved Next.js to 16.4.4, DOMPurify to 3.4.17 and follow-redirects to 1.16.2. `npm audit --omit=dev` reported zero vulnerabilities. The full development dependency audit still reported 16 moderate and two high advisories; these are not claimed fixed. The standard production build passed with the updated Next.js version.

## Distributed item controls (M7.5, activation pending)

For an execution with a distributed work profile, **Steps and data → Work items** provides stage selection, journal-derived stage counts with their observation interval/coverage, status filtering, ordinal lookup, bounded pages and item/attempt details. Input/output/receipt previews load only when requested. Empty filtered pages can have a next page; page counts cover that page. Stage counts are interval observations, not an atomic live snapshot, and missing/corrupt observations are unknown. Polling stops for terminal executions; refresh remains available.

After the execution settles as Failed/AwaitingReview, operators with recovery permission can select failed items, confirm their exact ordinals/attempts and retry them on the original revision. Uncertain writes require a separate acknowledgement. A lost response retains the request ID and offers **Resend retry request**; rejected selections remain visible. Completed items cannot be newly selected. Whole-step resume remains hidden. Explicit whole-execution replay creates a fresh run using the original or a selected published revision; it requires separate repeated-delivery and uncertain-write acknowledgements. Replay checks installation support, and preserves the request ID/options after a lost response. File-content suppression still applies unless force processing is selected.

The matching API routes, replay controls, bounded cleanup and accounting components are implemented, but the backend deliberately does not register the distributed production profile yet. Installed-host quota/health/retention/cold-Redis verification and activation remain gates in the backend's `docs/item-inspection-recovery-design.md`. This does not announce consumer-ready distributed hosting.
