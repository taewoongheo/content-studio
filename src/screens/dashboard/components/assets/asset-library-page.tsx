"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoredAsset } from "@/lib/local-db/assets";
import type { StoredCharacter } from "@/lib/local-db/characters";
import { createCharacter, deleteAsset, deleteCharacter, listLibrary, uploadAsset } from "../../api";
import { ImageUploadField } from "@/components/media/image-upload-field";

function AssetTile({ asset, busy, protectedAsset = false, onDelete }: { asset: StoredAsset; busy: boolean; protectedAsset?: boolean; onDelete: (asset: StoredAsset) => void }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-2.5">
    <Image src={`/api/library/assets/${encodeURIComponent(asset.id)}`} alt={asset.name} width={72} height={72}
      unoptimized className="size-18 shrink-0 rounded-md border bg-muted object-contain" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{asset.name}</p>
      {asset.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{asset.description}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">{Math.ceil(asset.size / 1024)} KB</p>
    </div>
    {!protectedAsset && <Button type="button" size="icon" variant="ghost" aria-label={`${asset.name} 삭제`}
      className="text-destructive hover:text-destructive" disabled={busy} onClick={() => onDelete(asset)}><Trash2 aria-hidden="true" /></Button>
    }
  </div>;
}

export function AssetLibraryPage() {
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [addingCharacter, setAddingCharacter] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(async () => {
    const library = await listLibrary();
    setCharacters(library.characters);
    setAssets(library.assets);
  }, []);

  useEffect(() => {
    let active = true;
    void listLibrary().then((library) => {
      if (active) { setCharacters(library.characters); setAssets(library.assets); }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "에셋을 불러오지 못했습니다.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addCharacter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!characterFile) return;
    setBusy(true); setError("");
    try {
      await createCharacter({ description: characterDescription, file: characterFile });
      await refresh(); setCharacterDescription(""); setCharacterFile(null); setAddingCharacter(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "캐릭터를 추가하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function addAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    try {
      await uploadAsset({ file, name, description });
      await refresh(); setFile(null); setName(""); setDescription(""); setAddingAsset(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "이미지를 추가하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function removeAsset(asset: StoredAsset) {
    if (!window.confirm(`“${asset.name}” 이미지를 로컬 DB에서 삭제할까요? 슬라이드에서 사용 중이라면 이미지가 보이지 않게 됩니다.`)) return;
    setBusy(true); setError("");
    try { await deleteAsset(asset.id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "이미지를 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function removeCharacter(character: StoredCharacter) {
    if (!window.confirm("이 캐릭터를 삭제할까요? 턴어라운드 이미지는 일반 에셋으로 남깁니다.")) return;
    setBusy(true); setError("");
    try { await deleteCharacter(character.id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "캐릭터를 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  const primaryAssetIds = new Set(characters.map((character) => character.turnaroundAssetId));
  const imageAssets = assets.filter((asset) => !primaryAssetIds.has(asset.id));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return <div className="grid gap-8">
    <div><h1 className="text-3xl font-semibold tracking-tight">이미지 에셋</h1>
      <p className="mt-2 text-sm text-muted-foreground">캐릭터 턴어라운드와 재사용할 이미지를 로컬 DB에서 관리합니다.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => setAddingAsset((value) => !value)}><ImagePlus aria-hidden="true" />이미지 추가</Button>
      <Button type="button" variant="outline" onClick={() => setAddingCharacter((value) => !value)}><Plus aria-hidden="true" />캐릭터 추가</Button>
    </div>

    {addingCharacter && <form onSubmit={(event) => void addCharacter(event)} className="grid gap-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">캐릭터 추가</h2>
      <ImageUploadField id="character-turnaround" label="턴어라운드 이미지" file={characterFile} onFileChange={setCharacterFile} disabled={busy} />
      <label className="grid gap-1.5 text-sm font-medium">설명<Textarea value={characterDescription} maxLength={2000} required onChange={(event) => setCharacterDescription(event.target.value)} placeholder="외형과 유지할 특징" /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAddingCharacter(false)}>취소</Button><Button type="submit" disabled={busy || !characterFile || !characterDescription.trim()}>추가</Button></div>
    </form>}

    {addingAsset && <form onSubmit={(event) => void addAsset(event)} className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">이미지 추가</h2>
      <div className="sm:col-span-2"><ImageUploadField id="asset-image" label="이미지 파일" file={file} disabled={busy} onFileChange={(next) => {
        setFile(next);
        if (next) setName((current) => current || next.name.replace(/\.[^.]+$/, ""));
      }} /></div>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">이름<Input value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} placeholder="예: 측면 · 스쿼트 하단 자세" /></label>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">설명<Textarea value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="이미지에서 실제로 보이는 대상·동작·구도를 적으세요" /></label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setAddingAsset(false)}>취소</Button><Button type="submit" disabled={busy || !file}>추가</Button></div>
    </form>}

    {loading ? <p role="status" className="text-sm text-muted-foreground">에셋을 불러오는 중…</p> : <>
      <section className="grid gap-4" aria-labelledby="character-title">
        <h2 id="character-title" className="text-lg font-semibold">캐릭터 <span className="text-muted-foreground">{characters.length}</span></h2>
        {characters.length === 0 ? <p className="rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground">아직 등록된 캐릭터가 없습니다.</p> :
          <div className="grid gap-4 lg:grid-cols-2">{characters.map((character) => {
            const turnaround = character.turnaroundAssetId ? assetsById.get(character.turnaroundAssetId) : null;
            return <article key={character.id} className="grid content-start gap-4 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3"><p className="min-w-0 text-sm">{character.description || "설명이 없는 이전 캐릭터"}</p>
                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="캐릭터 삭제" disabled={busy} onClick={() => void removeCharacter(character)}><Trash2 aria-hidden="true" /></Button></div>
              {turnaround ? <AssetTile asset={turnaround} busy={busy} protectedAsset onDelete={(item) => void removeAsset(item)} /> :
                <p className="text-sm text-muted-foreground">턴어라운드 이미지가 없습니다.</p>}
            </article>;
          })}</div>}
      </section>
      <section className="grid gap-4" aria-labelledby="image-assets-title">
        <h2 id="image-assets-title" className="text-lg font-semibold">이미지 에셋 <span className="text-muted-foreground">{imageAssets.length}</span></h2>
        {imageAssets.length === 0 ? <p className="rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground">아직 등록된 이미지가 없습니다.</p> :
          <div className="grid gap-2 lg:grid-cols-2">{imageAssets.map((asset) => <AssetTile key={asset.id} asset={asset} busy={busy} onDelete={(item) => void removeAsset(item)} />)}</div>}
      </section>
    </>}
  </div>;
}
