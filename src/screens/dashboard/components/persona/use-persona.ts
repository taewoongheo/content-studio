import { useEffect, useState } from "react";
import type { Persona, PersonaResponse, PersonaSettings } from "@/domains/content-production/domain/persona/model";

async function requestPersona(input?: unknown): Promise<PersonaResponse> {
  const response = await fetch("/api/persona", input ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "페르소나를 불러오지 못했습니다.");
  return data;
}

export function usePersona() {
  const [data, setData] = useState<PersonaResponse | null>(null);
  const [draft, setDraft] = useState<Persona | null>(null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const running = data?.job.state === "running";

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const next = await requestPersona();
        if (disposed) return;
        setData(next);
        setDraft(current => current ?? next.persona);
        setHandle(current => current || next.persona?.handle || "");
        setError("");
      } catch (error) {
        if (!disposed) setError(error instanceof Error ? error.message : "불러오기 실패");
      }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!running) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await requestPersona();
        if (disposed) return;
        setData(next);
        if (next.job.state !== "running") {
          setDraft(next.persona);
          setHandle(next.persona?.handle ?? "");
          setDirty(false);
          return;
        }
      } catch (error) {
        if (!disposed) setError(error instanceof Error ? error.message : "상태 조회 실패");
      }
      if (!disposed) timer = setTimeout(poll, 2000);
    }
    timer = setTimeout(poll, 1500);
    return () => { disposed = true; clearTimeout(timer); };
  }, [running]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(patch: Partial<Persona>) {
    setDraft(current => current ? { ...current, ...patch } : current);
    setDirty(true);
    setSaved(false);
  }
  async function act(input: unknown) {
    setBusy(true); setError(""); setSaved(false);
    try {
      const next = await requestPersona(input);
      setData(next);
      if (next.job.state !== "running") { setDraft(next.persona); setDirty(false); setSaved(true); }
    } catch (error) { setError(error instanceof Error ? error.message : "요청 실패"); }
    finally { setBusy(false); }
  }
  function save() {
    if (!draft) return;
    const settings: PersonaSettings = { name: draft.name, output_language: draft.output_language,
      content: draft.content };
    void act({ action: "save", revision: draft.revision, settings });
  }
  function analyze() {
    if ((draft || dirty) && !window.confirm("재분석이 완료되면 직접 수정한 내용과 설정을 포함해 기존 페르소나 전체를 새 결과로 교체합니다. 분석할까요?")) return;
    void act({ action: "analyze", handle });
  }
  return { data, draft, handle, setHandle, error, busy: busy || running, saved, dirty, update, save, analyze };
}
