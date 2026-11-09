// UI side mirror of the shapes in docs/ENGINE_SPEC.md and the get-map action.

export type FileNode = {
  path: string;
  lines: number;
  imports: string[];
  copies: number;
};

export type Member = {
  id: string;
  name: string;
  path: string;
  line: number;
  endLine: number;
  lines: number;
  declKind: "function" | "const";
  exported: boolean;
  isDefault: boolean;
  variant: number;
};

export type TwinSet = {
  id: string;
  name: string;
  kind: "exact" | "near";
  isComponent: boolean;
  members: Member[];
  duplicateLines: number;
  mergeable: boolean;
  reason?: string | undefined;
};

export type Diag = {
  file: string;
  line: number;
  col?: number;
  code: string;
  message: string;
};

export type MergeCaller = string;

export type MergeRecord = {
  id: string;
  setId: string;
  setName?: string | undefined;
  status: "kept" | "refused" | "undone" | "checking";
  caller: MergeCaller;
  summary: string;
  linesRemoved: number;
  linesAdded: number;
  added?: Diag[] | undefined;
  createdAt: string | number;
};

export type MapStatus = "scanning" | "preparing" | "ready" | "failed";

export type MapData = {
  status: MapStatus;
  statusDetail: string | null;
  repo: {
    owner: string;
    name: string;
    htmlUrl: string;
    sha: string;
    prUrl?: string | null | undefined;
  };
  files: FileNode[];
  sets: TwinSet[];
  baseline: {
    errors: number;
    coverage: { covered: number; total: number; ratio: number };
    build?: { ran: boolean; ok: boolean; ms?: number } | null;
    tests?: { ran: boolean; ok: boolean; ms?: number } | null;
  } | null;
  merges: MergeRecord[];
  metrics: {
    duplicateLinesStart: number;
    duplicateLinesNow: number;
    kept: number;
    refused: number;
  };
};

export type CompareMember = {
  id: string;
  path: string;
  line: number;
  endLine: number;
  code: string;
};

export type CompareResult = {
  setId: string;
  members: CompareMember[];
};
