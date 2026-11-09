import { useActionMutation } from "@agent-native/core/client/hooks";
import { IconArrowRight } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { BlueprintMap } from "./BlueprintMap";
import { fixtureMap } from "./fixture";
import { errorMessage } from "./use-twins";

const SAMPLE = "github.com/cmonson66/nectarpay-crm";

export function RepoInput() {
  const navigate = useNavigate();
  const importRepo = useActionMutation("import-repo");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function go(value: string) {
    const v = value.trim();
    if (!v) {
      setError("Paste a GitHub link like github.com/owner/repo");
      return;
    }
    setError(null);
    try {
      const r = (await importRepo.mutateAsync({ url: v })) as { id: string };
      navigate(`/map/${encodeURIComponent(r.id)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const pending = importRepo.isPending;

  return (
    <div className="tw relative flex min-h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.22]">
        <BlueprintMap files={fixtureMap.files} sets={fixtureMap.sets} quiet minHeight={0} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(242,241,237,0.6),var(--ink)_75%)]" />

      <div className="relative flex flex-1 flex-col justify-center px-5 py-16 md:px-14">
        <p className="tw-label">New map</p>
        <h1 className="tw-display mt-4 max-w-4xl text-[52px] md:text-[92px]">
          Paste a public
          <br />
          <span className="tw-pill-word">GitHub</span> repo.
        </h1>
        <form
          className="mt-10 flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void go(url);
          }}
        >
          <label className="flex-1">
            <span className="sr-only">GitHub repo link</span>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="github.com/owner/repo"
              spellCheck={false}
              autoComplete="off"
              className="tw-input w-full py-3 text-lg md:text-xl"
              disabled={pending}
            />
          </label>
          <button type="submit" className="tw-btn tw-btn-primary h-12 px-6" disabled={pending}>
            {pending ? "Downloading…" : "Map it"}
            <IconArrowRight className="size-4" strokeWidth={2} />
          </button>
        </form>
        {pending ? (
          <div className="relative mt-4 h-px max-w-3xl overflow-hidden bg-[var(--hair)]">
            <div className="tw-scan absolute inset-0" />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 max-w-3xl text-[14px] text-[var(--red)]">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[var(--paper-3)]">
          <span>No repo handy?</span>
          <button
            type="button"
            onClick={() => {
              setUrl(SAMPLE);
              void go(SAMPLE);
            }}
            disabled={pending}
            className="tw-mono text-[var(--paper-2)] underline decoration-[var(--hair-3)] underline-offset-4 hover:text-[var(--amber)]"
          >
            Try a real AI built app
          </button>
        </div>
        <p className="tw-mono mt-16 max-w-xl text-[11.5px] leading-relaxed text-[var(--paper-3)]">
          Public TypeScript repos, monorepos included, and JavaScript with a jsconfig.json. Your code is
          read on our server and only ever runs inside an isolated sandbox.
        </p>
      </div>
    </div>
  );
}
