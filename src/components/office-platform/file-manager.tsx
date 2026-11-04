"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import "./file-manager.css";

type ManagedFile = { id: string; projectId: string; villaId: string | null; label: string; note: string; kind: string; visibility: string; revision: number; archivedAt: string | null; createdAt: string; url: string };
type LegacyLink = { id: string; label: string; note: string; kind: string; url: string | null; sourceUrl: string; villaCode: string };
type FileList = { files: ManagedFile[]; hasMore: boolean; storageReady: boolean; legacyLinks: LegacyLink[]; legacyCount: number };
type Props = { projectId: string; villaId?: string; canManageDocuments: boolean };
async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "The file action could not be completed.");
  return value;
}
export function FileManager({ projectId, villaId, canManageDocuments }: Props) {
  const router = useRouter(); const loadSequence = useRef(0); const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<FileList>({ files: [], hasMore: false, storageReady: false, legacyLinks: [], legacyCount: 0 });
  const [page, setPage] = useState(0); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0); const [label, setLabel] = useState(""); const [note, setNote] = useState("");
  const [kind, setKind] = useState<"photo" | "doc">("photo"); const [projectScope, setProjectScope] = useState(!villaId);
  const [replacement, setReplacement] = useState<ManagedFile | null>(null);
  const [confirm, setConfirm] = useState<{ file: ManagedFile; action: string } | null>(null);
  const [editing, setEditing] = useState<ManagedFile | null>(null);
  const [editLabel, setEditLabel] = useState(""); const [editNote, setEditNote] = useState("");
  const [pending, setPending] = useState<{ assetId: string; intentId: string } | null>(null);
  const refresh = useCallback(async () => {
    const query = new URLSearchParams({ projectId, page: String(page) }); if (villaId) query.set("villaId", villaId);
    const sequence = ++loadSequence.current; setLoading(true);
    try { const value = await jsonRequest(`/api/files?${query}`); if (sequence === loadSequence.current) setResult(value); } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [projectId, villaId, page]);
  useEffect(() => { let active = true; setError(""); refresh().catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [refresh]);
  useEffect(() => { setReplacement(null); setPending(null); setConfirm(null); setEditing(null); setLabel(""); setNote(""); setProjectScope(!villaId); setPage(0); }, [projectId, villaId]);
  async function finishUploaded(intent: { assetId: string; intentId: string }) {
    await jsonRequest(`/api/files/${intent.assetId}/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intentId: intent.intentId }) });
    setPending(null); setReplacement(null); setLabel(""); setNote(""); if (fileInput.current) fileInput.current.value = "";
    setStatus("Upload saved internally. Share it when it is ready for buyers."); await refresh(); router.refresh();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setStatus(""); setBusy(true); setProgress(0);
    try {
      if (pending) { await finishUploaded(pending); return; }
      const file = fileInput.current?.files?.[0]; if (!file) throw new Error("Choose a file first.");
      const scope = replacement ? { projectId: replacement.projectId, villaId: replacement.villaId ?? undefined } : { projectId, villaId: projectScope ? undefined : villaId };
      const intent = await jsonRequest("/api/files/intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, kind: replacement?.kind ?? kind, label: replacement?.label ?? label, note: replacement?.note ?? note, fileName: file.name, contentType: file.type, byteSize: file.size, assetId: replacement?.id, expectedRevision: replacement?.revision }) });
      if (intent.driver === "local") {
        const response = await fetch(`/api/files/local-upload/${intent.intentId}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: file });
        if (!response.ok) throw new Error((await response.json()).error ?? "Upload failed."); setProgress(100);
      } else {
        await upload(intent.pathname, file, { access: "private", handleUploadUrl: "/api/files/upload", clientPayload: JSON.stringify({ intentId: intent.intentId }), multipart: file.size > 5 * 1024 * 1024, onUploadProgress: p => setProgress(Math.round(p.percentage)) });
      }
      const completion = { assetId: intent.assetId, intentId: intent.intentId }; setPending(completion); await finishUploaded(completion);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Please try again."); } finally { setBusy(false); }
  }
  async function change(file: ManagedFile, action: string) {
    setBusy(true); setError(""); setStatus("");
    try {
      await jsonRequest(`/api/files/${file.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, expectedRevision: file.revision, ...(action === "rename" ? { label: editLabel, note: editNote } : {}) }) });
      setConfirm(null); setEditing(null); setStatus(action === "share" ? "File shared with the selected buyers." : "File updated."); await refresh(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  function replace(file: ManagedFile) { setReplacement(file); setPending(null); setStatus(""); setError(""); setKind(file.kind as "photo" | "doc"); fileInput.current?.focus(); }
  return <section className="file-manager" aria-labelledby="managed-files-title">
    <header className="fm-heading"><div><p className="fm-eyebrow">Project records</p><h2 id="managed-files-title">{canManageDocuments ? "Files & construction photos" : "Construction photos"}</h2><p>Upload privately, review, then share with buyers.</p></div><span className="fm-private-label">Private by default</span></header>
    {error && <div role="alert" className="fm-error">{error}<button type="button" onClick={() => refresh().catch(e => setError(e.message))} disabled={busy}>Refresh files</button></div>}
    {status && <p className="fm-status" role="status">{status}</p>}
    <form onSubmit={submit} className="fm-upload">
      <div className="fm-form-heading"><h3>{replacement ? `Replace “${replacement.label}”` : "Add a file"}</h3>{replacement && <button type="button" disabled={busy} onClick={() => { setReplacement(null); setPending(null); }}>Cancel replacement</button>}</div>
      <fieldset disabled={busy || !result.storageReady || Boolean(pending)}>
        {!replacement && <div className="fm-fields">
          {canManageDocuments && <label>File type<select value={kind} onChange={e => setKind(e.target.value as "photo" | "doc")}><option value="photo">Construction photo</option><option value="doc">Document (PDF)</option></select></label>}
          {villaId && <label>Applies to<select value={projectScope ? "project" : "villa"} onChange={e => setProjectScope(e.target.value === "project")}><option value="villa">Selected villa only</option><option value="project">Entire project</option></select></label>}
          <label className="fm-wide">Name<input value={label} onChange={e => setLabel(e.target.value)} maxLength={200} required placeholder={kind === "photo" ? "Foundation work · November" : "Building permit"} /></label>
          <label className="fm-wide">Description <span>(optional)</span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={2} /></label>
        </div>}
        <label className="fm-file-label">{replacement ? "New version" : "Choose file"}<input ref={fileInput} type="file" accept={(replacement?.kind ?? kind) === "photo" ? "image/jpeg,image/png,image/webp" : "application/pdf"} required /></label>
      </fieldset>
      <div className="fm-upload-footer"><p>{replacement ? "The previous version is retained. The replacement will be internal until shared again." : "Photos: JPG, PNG or WebP, up to 15 MB. Documents: PDF, up to 20 MB."}</p><button className="fm-primary" disabled={busy || !result.storageReady} type="submit">{busy ? `Uploading ${progress}%` : pending ? "Retry saving upload" : replacement ? "Upload replacement" : "Upload internally"}</button></div>
      {busy && <progress className="fm-progress" value={progress} max={100} aria-label="Upload progress" />}
      {!loading && !result.storageReady && <p className="fm-error">Private file storage is not configured. Existing files remain listed; new uploads are unavailable.</p>}
    </form>
    {confirm && <div className="fm-confirm" role="group" aria-label="Confirm file change"><div><strong>{confirm.action === "share" ? "Share with buyers?" : "Archive this file?"}</strong><p>{confirm.action === "share" ? `${confirm.file.label} will be visible to ${confirm.file.villaId ? "the linked villa’s buyers" : "all buyers in this project"}.` : "The file will no longer be visible to buyers. You can restore it later."}</p></div><button type="button" className="fm-primary" disabled={busy} onClick={() => change(confirm.file, confirm.action)}>Confirm {confirm.action}</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div>}
    {editing && <form className="fm-edit" onSubmit={e => { e.preventDefault(); change(editing, "rename"); }}><h3>Edit file details</h3><label>Name<input required maxLength={200} value={editLabel} onChange={e => setEditLabel(e.target.value)} disabled={busy} /></label><label>Description<textarea maxLength={2000} rows={2} value={editNote} onChange={e => setEditNote(e.target.value)} disabled={busy} /></label><div className="fm-actions"><button className="fm-primary" type="submit" disabled={busy}>Save details</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div></form>}
    <div aria-busy={loading} className="fm-list">
      {loading ? <p className="fm-empty">Loading files…</p> : result.files.length === 0 ? <p className="fm-empty">No files uploaded yet. Add the first project record above.</p> : result.files.map(file => <article key={file.id} className={`fm-record${file.archivedAt ? " fm-archived" : ""}`}>
        <div className="fm-file-mark" aria-hidden="true">{file.kind === "photo" ? <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg> : <svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>}</div>
        <div className="fm-record-copy"><div className="fm-record-title"><h3>{file.label}</h3><span className={`fm-badge ${file.visibility === "shared" && !file.archivedAt ? "fm-shared" : ""}`}>{file.archivedAt ? "Archived" : file.visibility === "shared" ? "Shared with buyers" : "Internal"}</span></div><p>{file.villaId ? "Villa file" : "Entire project"} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(file.createdAt))}</p>{file.note && <p className="fm-note">{file.note}</p>}</div>
        <div className="fm-actions">{file.archivedAt ? <button type="button" disabled={busy} onClick={() => change(file, "restore")}>Restore internally</button> : <><a href={file.url} target="_blank" rel="noopener noreferrer">{file.kind === "photo" ? "View" : "Download"}</a><button type="button" disabled={busy} onClick={() => file.visibility === "shared" ? change(file, "hide") : setConfirm({ file, action: "share" })}>{file.visibility === "shared" ? "Make internal" : "Share"}</button><button type="button" disabled={busy} onClick={() => { setEditing(file); setEditLabel(file.label); setEditNote(file.note); }}>Edit details</button><button type="button" disabled={busy} onClick={() => replace(file)}>Replace</button><button type="button" disabled={busy} onClick={() => setConfirm({ file, action: "archive" })}>Archive</button></>}</div>
      </article>)}
    </div>
    {canManageDocuments && result.legacyCount > 0 && <details className="fm-legacy"><summary>Legacy links to migrate <span>{result.legacyCount}</span></summary><p>These are external links, not private managed files. They are retained for migration but are not shown to buyers. Download the original from its source, then re-upload it above and share it when ready. Nothing is imported automatically.</p><ul>{result.legacyLinks.map(file => <li key={file.id}><div><strong>{file.label}</strong><span>{file.kind === "photo" ? "Photo" : "Document"} · {file.villaCode} · External / not managed</span>{file.note && <p>{file.note}</p>}<code>{file.sourceUrl}</code></div>{file.url && <a href={file.url} target="_blank" rel="noopener noreferrer">Open external source ↗</a>}</li>)}</ul>{result.legacyCount > result.legacyLinks.length && <p>Showing the first {result.legacyLinks.length} of {result.legacyCount} legacy links. Select a villa to narrow the inventory.</p>}</details>}
    {(page > 0 || result.hasMore) && <nav className="fm-pagination" aria-label="File pages"><button type="button" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={loading || !result.hasMore} onClick={() => setPage(p => p + 1)}>Next</button></nav>}
  </section>;
}
