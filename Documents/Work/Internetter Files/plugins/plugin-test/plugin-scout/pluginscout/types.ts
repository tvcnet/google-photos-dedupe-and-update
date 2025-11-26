export interface WPPluginRawData {
  name: string;
  slug: string;
  version: string;
  author: string;
  author_profile: string;
  requires: string;
  tested: string;
  requires_php: string;
  last_updated: string;
  added: string;
  homepage: string;
  sections: {
    description: string;
    installation?: string;
    faq?: string;
    changelog?: string;
  };
  download_link: string;
  tags: Record<string, string>;
  versions: Record<string, string>;
  num_ratings: number;
  rating: number; // 0-100
  ratings: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  active_installs: number;
  downloaded: number;
  banner_low?: string;
  banner_high?: string;
  // Added for code analysis
  sourceCodeFiles?: Array<{ name: string; content: string }>;
  // Added for local uploads
  isLocal?: boolean;
}

export interface SecurityVulnerability {
  file: string;
  lineNumber: string; // String because sometimes it's a range or "General"
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  issueType: string; // e.g., "SQL Injection", "XSS", "Insecure Direct Object Reference"
  description: string;
  snippet?: string; // The specific code causing the issue
}

export interface AIAnalysisResult {
  score: number; // 0-100
  verdict: 'Excellent' | 'Good' | 'Caution' | 'Avoid';
  summary: string;
  pros: string[];
  cons: string[];
  securityRiskAssessment: string;
  maintenanceHealth: string;
  // New fields for deep code audit
  vulnerabilities: SecurityVulnerability[];
  codeQualityRating: 'A' | 'B' | 'C' | 'D' | 'F';
  // New field for web-based findings
  externalRisks: Array<{ title: string; url: string; source: string }>;
}

export interface AnalysisState {
  status: 'idle' | 'loading_metadata' | 'downloading_code' | 'searching_web' | 'analyzing_ai' | 'complete' | 'error';
  pluginData: WPPluginRawData | null;
  aiResult: AIAnalysisResult | null;
  error?: string;
}