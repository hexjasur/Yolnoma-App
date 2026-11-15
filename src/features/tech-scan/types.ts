export interface TechDetection {
  name: string;
  category: string;
  evidence: string;
}

export interface TechScanResult {
  url: string;
  host: string;
  status: number;
  generator: string | null;
  technologies: TechDetection[];
  hosting: TechDetection[];
  headers: Record<string, string>;
  nameServers: string[];
  cnameRecords: string[];
}
