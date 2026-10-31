export interface StarterFile {
  path: string;
  content: string;
}

export interface StarterTemplate {
  id: string;
  name: string;
  stack: "HTML" | "React";
  license: "MIT";
  description: string;
  variables: Array<{ name: string; description: string; defaultValue: string }>;
  files: StarterFile[];
}
