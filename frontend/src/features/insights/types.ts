export interface Report {
  id: number;
  title?: string;
  created_at?: number;
  session_count?: number;
  message_count?: number;
  snippet_count?: number;
  sources?: string[];
  scores?: { efficiency?: number; stability?: number; decision_clarity?: number };
  details?: Record<string, unknown>;
}

export interface Candidate {
  id: number;
  source: string;
  workspace?: string;
  preview?: string;
  external_id?: string;
  last_at?: number;
  message_count?: number;
}

export interface PlanItem {
  id: string;
  action: string;
  status: string;
  created_at?: number;
  source_report_id?: number;
}

export interface ModelSettings {
  mode_default: string;
  external_enabled: boolean;
  provider: string;
  base_url: string;
  model_name: string;
  api_key: string;
}

export interface InsightState {
  candidates: Candidate[];
  selected: Set<number>;
  sourceFilter: string;
  tab: string;
  currentReport: Report | null;
}

export interface ModelState {
  settings: ModelSettings;
  hasApiKey: boolean;
}
