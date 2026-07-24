export const queryKeys = {
  me: ["auth", "me"] as const,
  folders: ["folders"] as const,
  scores: ["scores"] as const,
  score: (id: string | number) => ["scores", String(id)] as const,
  scoreFile: (id: string | number) => ["scores", String(id), "file"] as const,
};
