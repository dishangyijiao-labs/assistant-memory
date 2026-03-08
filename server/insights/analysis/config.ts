export const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "you",
  "your",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "can",
  "will",
  "just",
  "about",
  "into",
  "then",
  "than",
  "what",
  "when",
  "where",
  "why",
  "how",
  "need",
  "please",
  "code",
  "file",
  "line",
  "project",
  "session",
  "message",
]);

export const TOPIC_DEFINITIONS = [
  {
    id: "react_next",
    title: "React / Next.js Architecture",
    keywords: [
      "react",
      "next",
      "server component",
      "client component",
      "hydration",
      "frontend",
      "rendering",
    ],
    summary:
      "Discussions focused on component boundaries, rendering strategy, and data flow for modern React applications.",
  },
  {
    id: "database_schema",
    title: "Database Schema & Multi-Tenant Design",
    keywords: [
      "database",
      "schema",
      "migration",
      "sql",
      "postgres",
      "tenant",
      "rls",
      "query",
      "index",
    ],
    summary:
      "Work centered on data modeling, schema evolution, query design, and tenant isolation patterns across services.",
  },
  {
    id: "devops_ci",
    title: "DevOps & CI/CD Pipelines",
    keywords: [
      "pipeline",
      "github actions",
      "docker",
      "kubernetes",
      "deploy",
      "infra",
      "ci",
      "cd",
      "cache",
    ],
    summary:
      "Sessions covered build pipelines, infrastructure automation, and release reliability for production delivery.",
  },
  {
    id: "typescript_patterns",
    title: "TypeScript Advanced Patterns",
    keywords: [
      "typescript",
      "generic",
      "type",
      "infer",
      "utility type",
      "tsc",
      "compile",
      "strict",
    ],
    summary:
      "The conversation explored advanced type modeling, compile-time validation, and reusable TypeScript abstractions.",
  },
  {
    id: "api_design",
    title: "API & Backend Integration",
    keywords: [
      "api",
      "endpoint",
      "route",
      "handler",
      "server",
      "backend",
      "validation",
      "request",
      "response",
    ],
    summary:
      "Work emphasized API contract clarity, backend implementation details, and end-to-end data contract consistency.",
  },
] as const;

export const CAPABILITY_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "Code Generation", keywords: ["implement", "write", "generate", "build", "create"] },
  { name: "Code Review", keywords: ["review", "refactor", "cleanup", "optimize"] },
  { name: "Debugging", keywords: ["error", "failed", "exception", "bug", "trace", "fix"] },
  { name: "Architecture", keywords: ["architecture", "design", "pattern", "trade-off"] },
  { name: "Schema Design", keywords: ["schema", "migration", "sql", "table", "index", "rls"] },
];

export const LANGUAGE_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "TypeScript", keywords: ["typescript", ".ts", ".tsx", "tsc"] },
  { name: "SQL", keywords: ["select", "insert", "update", "sql", "postgres", "sqlite"] },
  { name: "YAML", keywords: [".yml", ".yaml", "yaml", "github actions"] },
  { name: "CSS", keywords: ["css", "tailwind", "style", "layout", "flex", "grid"] },
  { name: "Rust", keywords: ["rust", "cargo", "tauri", ".rs"] },
  { name: "Python", keywords: ["python", "pip", "pytest"] },
];

export const SESSION_TYPE_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "Architecture", keywords: ["architecture", "design", "trade-off", "decision"] },
  { name: "Implementation", keywords: ["implement", "build", "write", "coding"] },
  { name: "Debugging", keywords: ["debug", "error", "failed", "bug"] },
  { name: "Learning", keywords: ["explain", "why", "learn", "understand"] },
];

export const RESPONSE_TIME_BINS = [
  { label: "2-10s", min: 2, max: 10 },
  { label: "10-30s", min: 10, max: 30 },
  { label: "30s-1m", min: 30, max: 60 },
  { label: "1-2m", min: 60, max: 120 },
  { label: "2-5m", min: 120, max: 300 },
  { label: ">5m", min: 300, max: Number.MAX_SAFE_INTEGER },
] as const;
