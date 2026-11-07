import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  ExternalLink,
  GitBranch,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { atlasClient } from "@/api/atlasClient";
import { usePreferences, type ThemePref } from "@/lib/atlas/preferences";
import "./landing.css";

const CLI_COMMAND = "npx -y @omghotekar/atlas-cli lookup 0x9010d07c";
const API_LOOKUP = "/v1/functions/0x9010d07c";
const SWARM_ROOT = "ac56bcf0360fe3d011060a8011b2ea1e3d71b7408c354075e05fa69f487ae386";
const SWARM_SHA = "0x67ec935b13fac924b07c7e98013c88f62ad7118f77361e6b93cb6cdeded949e4";
const ENS_ALLOW = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";
const ENS_DENY = "0xAd797f58aFD3265C00504382171eC0818262D3ca";
type LiveProof = { status: "ready" | "verified" | "failed"; detail: string };

const interfaces = [
  {
    number: "01",
    label: "STUDIO",
    headline: "Explore visually.",
    copy: "Search selectors, decode calldata, investigate transactions, and inspect source provenance in one workspace.",
    action: "Launch Studio",
    to: "/studio" as const,
  },
  {
    number: "02",
    label: "CLI",
    headline: "Stay in your terminal.",
    copy: "Run signature lookups and developer diagnostics directly from your command line.",
    action: "Try the CLI",
    to: "/developers" as const,
  },
  {
    number: "03",
    label: "REST API",
    headline: "Build on the API.",
    copy: "Query Ethereum contract intelligence through typed, validated REST endpoints.",
    action: "View API documentation",
    to: "/docs" as const,
  },
  {
    number: "04",
    label: "TYPESCRIPT SDK",
    headline: "Integrate in code.",
    copy: "Use a typed TypeScript client with validated results and structured errors.",
    action: "Explore SDK",
    to: "/developers" as const,
  },
] as const;

const sponsors = [
  { name: "Arkiv", key: "arkiv", description: "Canonical signature provenance" },
  { name: "Swarm", key: "swarm", description: "Content-addressed evidence" },
  { name: "ENSv2", key: "ensv2", description: "On-chain permission checks" },
  { name: "Anon-RPC", key: "anonRpc", description: "Browser privacy experiment" },
  { name: "0G", key: "zeroG", description: "Optional private inference" },
] as const;

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={"atlas-wordmark" + (dark ? " atlas-wordmark-inverse" : "")}>
      <span className="atlas-logo-mark" aria-hidden="true">
        <img
          src="/brand/atlas-orbital-star.png"
          alt=""
          className="atlas-brand-image"
          width={46}
          height={46}
        />
      </span>
      <span>ATLAS</span>
    </span>
  );
}

function Appearance() {
  const { prefs, setPref } = usePreferences();
  return (
    <label className="atlas-appearance">
      <span className="sr-only">Appearance</span>
      <select
        aria-label="Appearance"
        value={prefs.theme}
        onChange={(event) => setPref("theme", event.target.value as ThemePref)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}

function Landing() {
  const [copied, setCopied] = useState<"yes" | "no" | "failed">("no");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkingLive, setCheckingLive] = useState(false);
  const [liveStarted, setLiveStarted] = useState(false);
  const [liveChecks, setLiveChecks] = useState<
    Record<"arkiv" | "swarm" | "allowed" | "denied", LiveProof>
  >({
    arkiv: { status: "ready", detail: "Ready for a real Arkiv lookup." },
    swarm: { status: "ready", detail: "Ready for the verified Swarm manifest." },
    allowed: { status: "ready", detail: "Ready for a granted ENSv2 permission check." },
    denied: { status: "ready", detail: "Ready for a denied ENSv2 permission check." },
  });
  const [statuses, setStatuses] = useState<Record<string, string> | null>(null);
  const [proof, setProof] = useState<{
    state: "loading" | "ok" | "unavailable";
    signature?: string;
    source?: string;
    entityKey?: string;
  }>({ state: "loading" });

  useEffect(() => {
    let active = true;
    void atlasClient.getFunctionBySelector("0x9010d07c").then((result) => {
      if (!active) return;
      const candidate = result.kind === "ok" ? result.data.candidates[0] : undefined;
      if (candidate) {
        setProof({
          state: "ok",
          signature: candidate.signature,
          source: candidate.source,
          entityKey: candidate.entityKey,
        });
      } else {
        setProof({ state: "unavailable" });
      }
    });
    void atlasClient.integrationStatus().then((result) => {
      if (active && result.kind === "ok") setStatuses(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(CLI_COMMAND);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  async function runLiveProof() {
    if (checkingLive) return;
    setCheckingLive(true);
    setLiveStarted(true);
    try {
      const [arkiv, swarm, allowed, denied] = await Promise.all([
        atlasClient.getFunctionBySelector("0x9010d07c"),
        atlasClient.getSwarmArtifact(SWARM_ROOT),
        atlasClient.checkEnsV2Role({ account: ENS_ALLOW, role: "1", resource: "0" }),
        atlasClient.checkEnsV2Role({ account: ENS_DENY, role: "1", resource: "0" }),
      ]);
      const passed = {
        arkiv:
          arkiv.kind === "ok" &&
          arkiv.data.candidates.some(
            (candidate) =>
              candidate.signature === "getRoleMember(bytes32,uint256)" && !!candidate.entityKey,
          ),
        swarm:
          swarm.kind === "ok" &&
          swarm.data.sha256 === SWARM_SHA &&
          swarm.data.reference === SWARM_ROOT,
        allowed:
          allowed.kind === "ok" &&
          allowed.data.chainId === 11155111 &&
          allowed.data.authorized === true &&
          allowed.data.requiredRoles === "1",
        denied:
          denied.kind === "ok" &&
          denied.data.chainId === 11155111 &&
          denied.data.authorized === false &&
          denied.data.requiredRoles === "1",
      };
      setLiveChecks({
        arkiv: {
          status: passed.arkiv ? "verified" : "failed",
          detail: passed.arkiv
            ? "Canonical function found with Arkiv entity provenance."
            : "The live Arkiv response did not match.",
        },
        swarm: {
          status: passed.swarm ? "verified" : "failed",
          detail: passed.swarm
            ? "Stored manifest SHA-256 matches the pinned receipt."
            : "The live Swarm digest did not match.",
        },
        allowed: {
          status: passed.allowed ? "verified" : "failed",
          detail: passed.allowed
            ? "Sepolia EAC returned authorized: true."
            : "Granted ENSv2 role was not confirmed.",
        },
        denied: {
          status: passed.denied ? "verified" : "failed",
          detail: passed.denied
            ? "Sepolia EAC returned authorized: false."
            : "Denied ENSv2 role was not confirmed.",
        },
      });
    } catch {
      setLiveChecks({
        arkiv: { status: "failed", detail: "Request interrupted; open the JSON for details." },
        swarm: { status: "failed", detail: "Request interrupted; open the JSON for details." },
        allowed: { status: "failed", detail: "Request interrupted; open the JSON for details." },
        denied: { status: "failed", detail: "Request interrupted; open the JSON for details." },
      });
    } finally {
      setCheckingLive(false);
    }
  }

  const navLinks = [
    { label: "Studio", to: "/studio" as const },
    { label: "CLI", to: "/developers" as const },
    { label: "API", to: "/docs" as const },
    { label: "Docs", to: "/docs" as const },
  ];

  return (
    <div className="atlas-landing">
      <a href="#content" className="atlas-skip">
        Skip to content
      </a>
      <main id="content">
        <div className="atlas-landing-hero">
          <section className="atlas-landing-left" aria-labelledby="atlas-hero-title">
            <div className="atlas-pixel-field" aria-hidden="true" />
            <header className="atlas-landing-header">
              <Link to="/" aria-label="ATLAS home" className="atlas-logo-link">
                <Logo />
              </Link>
              <nav className="atlas-landing-nav" aria-label="Website">
                <a href="#live-demo">Live demo</a>
                {navLinks.map((item) => (
                  <Link key={item.label} to={item.to}>
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://github.com/omghotekar01-dotcom/ATLAS"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </nav>
              <div className="atlas-header-actions">
                <Link to="/studio" className="atlas-header-cta">
                  Open Studio <ArrowUpRight size={13} />
                </Link>
                <button
                  type="button"
                  className="atlas-mobile-toggle"
                  aria-expanded={mobileOpen}
                  aria-controls="atlas-mobile-links"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  onClick={() => setMobileOpen((value) => !value)}
                >
                  {mobileOpen ? <X size={19} /> : <Menu size={19} />}
                </button>
              </div>
            </header>

            {mobileOpen && (
              <nav
                id="atlas-mobile-links"
                className="atlas-mobile-menu"
                aria-label="Mobile website navigation"
              >
                <a href="#live-demo" onClick={() => setMobileOpen(false)}>
                  Live demo
                </a>
                {navLinks.map((item) => (
                  <Link key={item.label} to={item.to} onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://github.com/omghotekar01-dotcom/ATLAS"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileOpen(false)}
                >
                  GitHub
                </a>
              </nav>
            )}

            <div className="atlas-landing-hero-main">
              <span className="atlas-hero-eyebrow">
                <span className="atlas-eyebrow-dot" /> ETHEREUM DEVELOPER INTELLIGENCE
              </span>
              <h1 id="atlas-hero-title">
                <span>Ethereum, decoded.</span>
                <span>
                  With receipts<span className="atlas-blue-period">.</span>
                </span>
              </h1>
              <p className="atlas-hero-summary">
                Search contract signatures, decode calldata, inspect transactions, and trace results
                back to their sources.
              </p>

              <div className="atlas-terminal-card" id="terminal">
                <div className="atlas-terminal-top">
                  <div className="atlas-terminal-label">
                    <span className="atlas-terminal-indicator" /> TRY ATLAS IN YOUR TERMINAL
                  </div>
                  <span className="atlas-terminal-node">NODE.JS</span>
                </div>
                <div className="atlas-terminal-command">
                  <span className="atlas-terminal-dollar" aria-hidden="true">
                    $
                  </span>
                  <code>{CLI_COMMAND}</code>
                </div>
                <div className="atlas-terminal-footer">
                  <span>No global installation. Node.js and API connectivity required.</span>
                  <button
                    type="button"
                    onClick={() => void copyCommand()}
                    aria-label="Copy exact ATLAS CLI command"
                  >
                    {copied === "yes" ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied === "yes" ? "Copied" : "Copy"}
                  </button>
                </div>
                {copied === "failed" && (
                  <p className="atlas-copy-error" role="status">
                    Clipboard blocked. Select and copy the command above.
                  </p>
                )}
              </div>

              <div className="atlas-hero-ctas">
                <Link to="/studio" className="atlas-button-primary">
                  Open Studio <ArrowUpRight size={18} />
                </Link>
                <a href="#live-demo" className="atlas-button-secondary">
                  Try live proof <ArrowRight size={18} />
                </a>
              </div>

              <div className="atlas-trust-note">
                <ShieldCheck size={15} /> Source-aware results. Explicit ambiguity. No invented
                verification.
              </div>
            </div>

            <div className="atlas-hero-bottom">
              <span>
                SEARCH <b>•</b> DECODE <b>•</b> INVESTIGATE <b>•</b> INTEGRATE
              </span>
              <Appearance />
            </div>
          </section>

          <section className="atlas-landing-right" aria-labelledby="atlas-interfaces-title">
            <div className="atlas-right-head">
              <div className="atlas-right-meta">
                <span className="atlas-right-meta-dot" /> ATLAS / PRODUCT ACCESS
              </div>
              <span className="atlas-right-edition">ETHGLOBAL MUMBAI 2026</span>
            </div>
            <div className="atlas-right-title-wrap">
              <span className="atlas-right-kicker">ONE PLATFORM. FOUR INTERFACES.</span>
              <h2 id="atlas-interfaces-title">
                Built for the way
                <br /> developers work<span>.</span>
              </h2>
              <p>One source-aware toolkit. The interface is yours to choose.</p>
            </div>
            <div className="atlas-interface-list">
              {interfaces.map((item) => (
                <Link key={item.number} to={item.to} className="atlas-interface-row">
                  <span className="atlas-row-index">{item.number}</span>
                  <div className="atlas-row-content">
                    <span className="atlas-row-label">{item.label}</span>
                    <h3>{item.headline}</h3>
                    <p>{item.copy}</p>
                    <span className="atlas-row-link">
                      {item.action} <ArrowUpRight size={14} />
                    </span>
                  </div>
                  <ArrowUpRight className="atlas-row-corner" size={19} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <div className="atlas-right-foot">
              <span>ENGINEERED FOR EVIDENCE</span>
              <span>01 / 04</span>
            </div>
          </section>
        </div>

        <section className="atlas-visual-story" aria-labelledby="atlas-visual-title">
          <div className="atlas-visual-story-heading">
            <div>
              <span className="atlas-section-eyebrow">BUILT FOR ETHEREUM DEVELOPERS</span>
              <h2 id="atlas-visual-title">A clearer view of on-chain interactions.</h2>
            </div>
            <Link to="/studio" className="atlas-inline-link">
              Open the working Studio <ArrowUpRight size={16} />
            </Link>
          </div>
          <figure className="atlas-visual-story-figure">
            <img
              src="/brand/atlas-ethereum-context.png"
              alt="ATLAS project artwork: a developer studying Ethereum function signatures, calldata decoding, transactions and API or SDK tools on a monitor."
              width={1672}
              height={941}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              Illustrative project artwork. Explore the actual tools and verified data inside ATLAS
              Studio.
            </figcaption>
          </figure>
        </section>

        <section id="live-demo" className="atlas-quick-guide" aria-labelledby="atlas-quick-title">
          <div className="atlas-guide-header">
            <div>
              <span className="atlas-section-eyebrow">START HERE — NO WALLET REQUIRED</span>
              <h2 id="atlas-quick-title">See the evidence in one click.</h2>
            </div>
            <p>
              First time using ATLAS? Test the public APIs without any setup. Green results only
              appear when a live response matches the known evidence.
            </p>
            <button
              type="button"
              className="atlas-guide-run"
              disabled={checkingLive}
              onClick={() => void runLiveProof()}
            >
              {checkingLive
                ? "Checking live APIs…"
                : liveStarted
                  ? "Run fresh proof"
                  : "Run live proof"}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="atlas-guide-grid">
            {(
              [
                ["arkiv", "01", "Arkiv · Find the real ABI", "/v1/functions/0x9010d07c"],
                ["swarm", "02", "Swarm · Verify the source root", "/v1/artifacts/" + SWARM_ROOT],
                [
                  "allowed",
                  "03",
                  "ENSv2 · Granted permission",
                  "/v1/ensv2/roles/" + ENS_ALLOW + "?resource=0&role=1",
                ],
                [
                  "denied",
                  "04",
                  "ENSv2 · Denied permission",
                  "/v1/ensv2/roles/" + ENS_DENY + "?resource=0&role=1",
                ],
              ] as const
            ).map(([key, number, title, url]) => (
              <article className="atlas-guide-card" key={key}>
                <div className="atlas-guide-card-top">
                  <span>{number}</span>
                  <span
                    role="status"
                    className={"atlas-guide-status atlas-guide-status-" + liveChecks[key].status}
                  >
                    {checkingLive
                      ? "CHECKING"
                      : liveChecks[key].status === "verified"
                        ? "LIVE VERIFIED"
                        : liveChecks[key].status === "failed"
                          ? "NOT VERIFIED"
                          : "READY"}
                  </span>
                </div>
                <h3>{title}</h3>
                <p>{liveChecks[key].detail}</p>
                <a href={url} target="_blank" rel="noreferrer">
                  Inspect actual JSON <ExternalLink size={13} />
                </a>
              </article>
            ))}
          </div>
          <p className="atlas-guide-note">
            Evidence limits: one canonical Arkiv signature entity is live, while the Swarm dataset
            contains 3,892 extracted declarations. ENSv2 registry permissions do not establish ABI
            authorship. 0G inference and default Anon-RPC routing remain unverified.
          </p>
        </section>

        <section className="atlas-landing-proof" aria-labelledby="atlas-proof-title">
          <div className="atlas-section-intro">
            <div>
              <span className="atlas-section-eyebrow">THE DIFFERENCE IS PROVENANCE</span>
              <h2 id="atlas-proof-title">
                From selector <em>to source.</em>
              </h2>
            </div>
            <p>
              Inspect an actual Arkiv-backed signature instead of accepting an opaque, unverified
              name match.
            </p>
          </div>
          <div className="atlas-proof-flow">
            <div>
              <span>01 / SELECTOR</span>
              <strong>0x9010d07c</strong>
            </div>
            <ChevronRight size={18} className="atlas-proof-chevron" />
            <div>
              <span>02 / SIGNATURE</span>
              <strong>
                {proof.state === "ok"
                  ? proof.signature
                  : proof.state === "loading"
                    ? "Checking live API…"
                    : "Live record unavailable"}
              </strong>
            </div>
            <ChevronRight size={18} className="atlas-proof-chevron" />
            <div>
              <span>03 / SOURCE</span>
              <strong>{proof.state === "ok" ? proof.source : "Check the API"}</strong>
            </div>
            <ChevronRight size={18} className="atlas-proof-chevron" />
            <div>
              <span>04 / REGISTRY</span>
              <strong>Arkiv Rabdi</strong>
            </div>
          </div>
          <div className="atlas-proof-bottom">
            <p>
              <ShieldCheck size={16} />{" "}
              {proof.state === "ok"
                ? "Read from the live canonical registry."
                : "Live verification pending; no fixture results displayed."}
            </p>
            <div>
              <Link to="/explorer" className="atlas-inline-link">
                Open Explorer <ArrowUpRight size={15} />
              </Link>
              <a href={API_LOOKUP} className="atlas-inline-link" target="_blank" rel="noreferrer">
                View JSON <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </section>

        <section className="atlas-landing-access" aria-labelledby="atlas-access-title">
          <div className="atlas-section-intro">
            <div>
              <span className="atlas-section-eyebrow">YOUR WORKFLOW. YOUR INTERFACE.</span>
              <h2 id="atlas-access-title">Everything connects.</h2>
            </div>
            <p>
              Open the exact tool you need, or embed ATLAS in your application with its validated
              client and API.
            </p>
          </div>
          <div className="atlas-access-grid">
            <Link to="/studio" className="atlas-access-card">
              <span className="atlas-access-icon">
                <ArrowUpRight size={23} />
              </span>
              <span>01 — STUDIO</span>
              <h3>Follow the transaction.</h3>
              <p>Explorer, calldata decoder, event inspector, and transaction lab.</p>
              <strong>
                Enter workspace <ArrowRight size={16} />
              </strong>
            </Link>
            <Link to="/developers" className="atlas-access-card">
              <span className="atlas-access-icon">
                <Code2 size={23} />
              </span>
              <span>02 — CLI</span>
              <h3>Terminal-first tools.</h3>
              <p>Published npx workflow for signature lookups and diagnostics.</p>
              <strong>
                View CLI setup <ArrowRight size={16} />
              </strong>
            </Link>
            <Link to="/docs" className="atlas-access-card">
              <span className="atlas-access-icon">
                <GitBranch size={23} />
              </span>
              <span>03 — REST API</span>
              <h3>Build with the data.</h3>
              <p>Health, function lookup, signature search and calldata decoding.</p>
              <strong>
                Read API docs <ArrowRight size={16} />
              </strong>
            </Link>
            <Link to="/developers" className="atlas-access-card">
              <span className="atlas-access-icon">
                <Code2 size={23} />
              </span>
              <span>04 — SDK</span>
              <h3>Typed by design.</h3>
              <p>Source-based TypeScript client with schema validation and structured errors.</p>
              <strong>
                Explore SDK <ArrowRight size={16} />
              </strong>
            </Link>
          </div>
        </section>

        <section className="atlas-landing-infrastructure" aria-labelledby="atlas-infra-title">
          <div className="atlas-section-intro">
            <div>
              <span className="atlas-section-eyebrow">ONLY THE EVIDENCE WE HAVE</span>
              <h2 id="atlas-infra-title">Infrastructure, with evidence.</h2>
            </div>
            <Link to="/integrations" className="atlas-inline-link">
              Explore integrations <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="atlas-infra-list">
            {sponsors.map((sponsor) => {
              const state = statuses?.[sponsor.key];
              const label =
                state === "connected"
                  ? "Connected · probed"
                  : state === "browser-only"
                    ? "Browser-only"
                    : state === "unconfigured"
                      ? "Not configured"
                      : state === undefined
                        ? "Checking"
                        : state;
              return (
                <div className="atlas-infra-item" key={sponsor.key}>
                  <div>
                    <strong>{sponsor.name}</strong>
                    <span>{sponsor.description}</span>
                  </div>
                  <span
                    className={
                      "atlas-infra-status" + (state === "connected" ? " atlas-infra-connected" : "")
                    }
                  >
                    <i aria-hidden="true" /> {label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="atlas-infra-disclaimer">
            Connectivity means a configured probe succeeded. It does not imply sponsorship, full
            product integration, or ownership of the underlying contract.
          </p>
        </section>
      </main>
      <footer className="atlas-landing-footer">
        <Logo />
        <span>Ethereum developer intelligence, with source-aware receipts.</span>
        <div>
          <Link to="/docs">Documentation</Link>
          <Link to="/status">Status</Link>
          <a href="https://github.com/omghotekar01-dotcom/ATLAS" target="_blank" rel="noreferrer">
            GitHub <ExternalLink size={13} />
          </a>
        </div>
      </footer>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ATLAS — Ethereum Developer Intelligence Platform" },
      {
        name: "description",
        content:
          "Search contract signatures, decode calldata, inspect transactions, and trace source provenance with ATLAS Studio, CLI, API and SDK.",
      },
      { property: "og:title", content: "ATLAS — Ethereum, decoded. With receipts." },
      {
        property: "og:image",
        content: "https://atlas-ethglobal.vercel.app/brand/atlas-ethereum-context.png",
      },
      { property: "og:image:width", content: "1672" },
      { property: "og:image:height", content: "941" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Search. Decode. Investigate. Integrate. Source-aware Ethereum developer intelligence.",
      },
    ],
  }),
  component: Landing,
});
