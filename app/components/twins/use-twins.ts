import {
  actionErrorCode,
  callAction,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type {
  CompareResult,
  Diag,
  MapData,
  MapStatus,
  Member,
  MergeRecord,
  TwinSet,
} from "./types";

export function errorMessage(error: unknown): string {
  if (!error) return "";
  const e = error as { actionMessage?: string; message?: string };
  return e.actionMessage ?? e.message ?? String(error);
}

export type MergeOutcome =
  | { status: "kept"; mergeId?: string | undefined }
  | { status: "refused"; added: Diag[]; message: string; mergeId?: string | undefined }
  | { status: "error"; message: string };

/* ------------------------------ normalizers ------------------------------- */
// get-map returns sets with a member count; find-twins carries the members.

type RawMap = {
  repo: { id?: string; owner: string; name: string; sha: string; htmlUrl: string };
  status: string;
  statusDetail: string | null;
  files: MapData["files"];
  sets: (Omit<TwinSet, "members" | "reason"> & {
    members: number | Member[];
    reason?: string | null;
  })[];
  baseline: MapData["baseline"];
  merges: (Omit<MergeRecord, "status" | "added"> & {
    status: string;
    added?: Diag[] | null;
  })[];
  metrics: {
    duplicateLinesAtStart: number;
    duplicateLinesNow: number;
    mergesKept: number;
    mergesRefused: number;
  };
};

type RawTwins = {
  sets: (Omit<TwinSet, "reason"> & { reason?: string | null })[];
};

function normalize(raw: RawMap, twins: RawTwins | undefined): MapData {
  const members = new Map(twins?.sets.map((s) => [s.id, s.members]) ?? []);
  return {
    status: raw.status as MapStatus,
    statusDetail: raw.statusDetail,
    repo: raw.repo,
    files: raw.files,
    sets: raw.sets.map((s) => ({
      ...s,
      reason: s.reason ?? undefined,
      members: Array.isArray(s.members) ? s.members : (members.get(s.id) ?? []),
    })),
    baseline: raw.baseline,
    // Newest first.
    merges: raw.merges
      .map((m) => ({
        ...m,
        status: m.status as MergeRecord["status"],
        added: m.added ?? undefined,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    metrics: {
      duplicateLinesStart: raw.metrics.duplicateLinesAtStart,
      duplicateLinesNow: raw.metrics.duplicateLinesNow,
      kept: raw.metrics.mergesKept,
      refused: raw.metrics.mergesRefused,
    },
  };
}

/* --------------------------------- hooks --------------------------------- */

export function useTwinsMap(repoId: string) {
  const map = useActionQuery(
    "get-map",
    { repoId },
    {
      refetchInterval: (q) => {
        const data = q.state.data as RawMap | undefined;
        if (!data) return false;
        return data.status === "ready" || data.status === "failed"
          ? 5000
          : 1200;
      },
    },
  );
  const twins = useActionQuery(
    "find-twins",
    { repoId, kind: "all", limit: 200 },
    { enabled: Boolean(map.data) },
  );
  const rawMap = map.data as RawMap | undefined;
  const rawTwins = twins.data as RawTwins | undefined;
  const data = useMemo(
    () => (rawMap ? normalize(rawMap, rawTwins) : null),
    [rawMap, rawTwins],
  );
  return { data, error: map.error, isLoading: map.isLoading };
}

export function useCompare(repoId: string, setId: string | null) {
  const query = useActionQuery(
    "compare-twins",
    { repoId, setId: setId ?? "" },
    { enabled: Boolean(setId) },
  );
  const raw = query.data as
    | {
        setId: string;
        members: {
          id: string;
          path: string;
          line: number;
          endLine: number;
          source: string;
        }[];
      }
    | undefined;
  const data: CompareResult | null = raw
    ? {
        setId: raw.setId,
        members: raw.members.map((m) => ({ ...m, code: m.source })),
      }
    : null;
  return {
    data,
    error: query.error,
    isLoading: query.isLoading && Boolean(setId),
  };
}

export function useTwinsActions(repoId: string) {
  const qc = useQueryClient();
  const merge = useActionMutation("merge-twins");
  const undo = useActionMutation("undo-merge");
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["action"] }),
    [qc],
  );

  const runMerge = useCallback(
    async (setId: string): Promise<MergeOutcome> => {
      try {
        const result = (await merge.mutateAsync({ repoId, setId })) as
          | { mergeId?: string | undefined }
          | undefined;
        await refresh();
        return { status: "kept", mergeId: result?.mergeId };
      } catch (error) {
        await refresh();
        if (actionErrorCode(error) === "merge_refused") {
          const details = (
            error as { details?: { added?: Diag[]; mergeId?: string | undefined } }
          ).details;
          return {
            status: "refused",
            added: details?.added ?? [],
            mergeId: details?.mergeId,
            message: errorMessage(error),
          };
        }
        return { status: "error", message: errorMessage(error) };
      }
    },
    [merge, refresh, repoId],
  );

  const runUndo = useCallback(
    async (mergeId: string) => {
      await undo.mutateAsync({ repoId, mergeId });
      void refresh();
    },
    [refresh, repoId, undo],
  );

  const runExport = useCallback(
    async () =>
      (await callAction("export-patch", { repoId }, { method: "GET" })) as {
        patch?: string;
      },
    [repoId],
  );

  return { runMerge, runUndo, runExport, undoPending: undo.isPending };
}
