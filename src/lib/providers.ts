// Static provider definitions shared by browser and server. Adding an API = one entry here
// (+ a test/adapter in src/lib/server/providers.server.ts).
export type Capability = "data" | "broker" | "news" | "custom";

export type Field = {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "url";
  secret?: boolean;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
};

export type ProviderDef = {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  capabilities: Capability[];
  fields: Field[];
  hasEnvironment?: boolean;
};

export const PROVIDERS: ProviderDef[] = [
  {
    id: "alpaca",
    name: "Alpaca",
    capabilities: ["data", "broker"],
    hasEnvironment: true,
    description: "Stock market data + commission-free broker with a free paper account.",
    docsUrl: "https://docs.alpaca.markets",
    fields: [
      { key: "key_id", label: "API Key ID", type: "text", secret: true, required: true },
      { key: "secret_key", label: "Secret Key", type: "password", secret: true, required: true },
      { key: "feed", label: "Data feed", type: "select", options: ["iex", "sip"], help: "Free accounts use iex" },
    ],
  },
  {
    id: "polygon",
    name: "Polygon.io",
    capabilities: ["data"],
    description: "Historical + real-time stock bars.",
    docsUrl: "https://polygon.io/docs",
    fields: [{ key: "api_key", label: "API Key", type: "password", secret: true, required: true }],
  },
  {
    id: "finnhub",
    name: "Finnhub",
    capabilities: ["news"],
    description: "Company news and fundamentals.",
    docsUrl: "https://finnhub.io/docs/api",
    fields: [{ key: "token", label: "API Token", type: "password", secret: true, required: true }],
  },
  {
    id: "custom",
    name: "Custom REST API",
    capabilities: ["custom"],
    description: "Any HTTP JSON API. Called through the secure proxy.",
    docsUrl: "",
    fields: [
      { key: "base_url", label: "Base URL", type: "url", required: true, placeholder: "https://api.example.com" },
      { key: "auth_type", label: "Auth type", type: "select", options: ["none", "header", "query", "bearer"], required: true },
      { key: "auth_name", label: "Header / query param name", type: "text", placeholder: "X-API-Key or apikey" },
      { key: "auth_value", label: "Key / token", type: "password", secret: true },
      { key: "extra_headers", label: "Extra headers (JSON)", type: "text", placeholder: '{"Accept":"application/json"}' },
      { key: "test_path", label: "Test path", type: "text", placeholder: "/v1/status" },
    ],
  },
];

export const getProviderDef = (id: string) => {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown provider ${id}`);
  return p;
};

export const CAPABILITY_LABEL: Record<Capability, string> = {
  data: "Market data",
  broker: "Broker",
  news: "News",
  custom: "Custom APIs",
};
