import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { formatBytes, timeAgo } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Music,
  Pencil,
  Presentation,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

function fileIcon(kind?: string) {
  switch (kind) {
    case "image":
      return <ImageIcon className="size-5" />;
    case "video":
      return <FileVideo className="size-5" />;
    case "audio":
      return <Music className="size-5" />;
    case "pdf":
      return <FileText className="size-5" />;
    case "sheet":
      return <FileSpreadsheet className="size-5" />;
    case "slides":
      return <Presentation className="size-5" />;
    case "archive":
      return <FileArchive className="size-5" />;
    default:
      return <FileText className="size-5" />;
  }
}

export function AppFiles() {
  const { user } = useAuth();
  const data = useQuery(api.files.myFiles);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFile = useMutation(api.files.saveFile);
  const createFolder = useMutation(api.files.createFolder);
  const deleteFile = useMutation(api.files.deleteFile);
  const renameFile = useMutation(api.files.renameFile);

  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const dragCount = useRef(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const files = (data?.files ?? []).filter((f) => folderFilter ? f.folderId === folderFilter : !f.folderId);
  const folders = data?.folders ?? [];

  const handleUpload = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading({ name: arr[0].name, pct: 0 });
    try {
      for (const f of arr) {
        const res = await uploadFile(f, () => generateUploadUrl(), (pct) =>
          setUploading({ name: f.name, pct }),
        );
        await saveFile({
          storageId: res.storageId,
          url: res.url,
          name: res.name,
          mimeType: res.mimeType,
          size: res.size,
          kind: res.kind,
          folderId: folderFilter ? (folderFilter as any) : undefined,
        });
      }
      toast(`Uploaded ${arr.length} file${arr.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const isPreviewable = (mime: string) =>
    mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("video/") || mime.startsWith("audio/");

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Files</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data ? `${data.files.length} files · ${formatBytes(data.totalBytes)} used` : "Loading…"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFolderDialog(true)}>
              <FolderPlus className="size-4" /> New folder
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => fileRef.current?.click()}
            >
              <UploadCloud className="size-4" /> Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* dropzone */}
        <div
          className={cn(
            "mt-5 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/8" : "border-border/80",
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            dragCount.current++;
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragCount.current--;
            if (dragCount.current <= 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragCount.current = 0;
            setDragging(false);
            if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <div className="mx-auto max-w-sm">
              <Loader2 className="mx-auto mb-2 size-6 animate-spin text-primary" />
              <p className="text-sm font-medium">{uploading.name}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent">
                <div className="h-full bg-primary transition-all" style={{ width: `${uploading.pct}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <UploadCloud className="size-8 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Drag & drop files here</p>
                <p className="text-xs text-muted-foreground">or click upload — images, docs, video, audio</p>
              </div>
            </div>
          )}
        </div>

        {/* folders */}
        {folders.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Folders
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setFolderFilter(null)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                  folderFilter === null ? "border-primary/50 bg-primary/8 text-primary" : "border-border/80 hover:border-primary/30",
                )}
              >
                <Folder className="size-4" /> All files
              </button>
              {folders.map((f) => (
                <button
                  key={f._id}
                  onClick={() => setFolderFilter(f._id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                    folderFilter === f._id ? "border-primary/50 bg-primary/8 text-primary" : "border-border/80 hover:border-primary/30",
                  )}
                >
                  <Folder className="size-4" /> {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* file grid */}
        <div className="mt-6">
          <div className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {folderFilter ? "Folder contents" : "All files"}
          </div>
          {files.length === 0 ? (
            <div className="glass hairline rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No files here yet. Upload something to get started.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {files.map((f, i) => (
                <motion.div
                  key={f._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="group glass hairline card-hover relative overflow-hidden rounded-2xl"
                >
                  <button
                    className="block w-full"
                    onClick={() => isPreviewable(f.mimeType) && setPreview({ url: f.url, name: f.name, mimeType: f.mimeType })}
                  >
                    {f.kind === "image" ? (
                      <div className="aspect-video overflow-hidden bg-black/30">
                        <img src={f.url} alt={f.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                      </div>
                    ) : (
                      <div className="grid aspect-video place-items-center bg-accent text-muted-foreground">
                        <div className="text-center">
                          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/12 text-primary">
                            {fileIcon(f.kind)}
                          </div>
                          <span className="mt-2 block text-[10px] uppercase tracking-wider">
                            {f.mimeType.split("/")[1] ?? "file"}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {renaming === f._id ? (
                          <Input
                            value={renameValue}
                            autoFocus
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                renameFile({ fileId: f._id as any, name: renameValue }).then(() => setRenaming(null));
                              }
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="h-7 text-xs"
                          />
                        ) : (
                          <button
                            className="block max-w-full truncate text-sm font-medium hover:underline"
                            onClick={() => isPreviewable(f.mimeType) && setPreview({ url: f.url, name: f.name, mimeType: f.mimeType })}
                          >
                            {f.name}
                          </button>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {formatBytes(f.size)} · {timeAgo(f.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* hover actions */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <ActionIcon title="Download" onClick={() => download(f.url, f.name)}>
                      <Download className="size-3.5" />
                    </ActionIcon>
                    <ActionIcon
                      title="Rename"
                      onClick={() => {
                        setRenaming(f._id);
                        setRenameValue(f.name);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </ActionIcon>
                    <ActionIcon
                      title="Delete"
                      danger
                      onClick={() => deleteFile({ fileId: f._id as any }).then(() => toast("File deleted"))}
                    >
                      <Trash2 className="size-3.5" />
                    </ActionIcon>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* preview modal */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2">
          <DialogTitle className="sr-only">{preview?.name}</DialogTitle>
          <div className="flex items-center justify-between px-2 pb-1 pt-2 text-xs text-white/60">
            <span className="truncate">{preview?.name}</span>
            <Button variant="ghost" size="icon-sm" className="text-white/60" onClick={() => setPreview(null)}>
              <X className="size-4" />
            </Button>
          </div>
          {preview && preview.mimeType.startsWith("image/") && (
            <img src={preview.url} alt={preview.name} className="max-h-[78vh] w-full rounded-xl object-contain" />
          )}
          {preview && preview.mimeType === "application/pdf" && (
            <iframe src={preview.url} title={preview.name} className="h-[78vh] w-full rounded-xl bg-white" />
          )}
          {preview && preview.mimeType.startsWith("video/") && (
            <video src={preview.url} controls autoPlay className="max-h-[78vh] w-full rounded-xl" />
          )}
          {preview && preview.mimeType.startsWith("audio/") && (
            <div className="grid h-[40vh] place-items-center">
              <audio src={preview.url} controls autoPlay className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* new folder dialog */}
      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base font-semibold">New folder</DialogTitle>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            className="h-10"
            onKeyDown={(e) => {
              if (e.key === "Enter" && folderName.trim()) {
                createFolder({ name: folderName.trim() }).then(() => {
                  setFolderName("");
                  setFolderDialog(false);
                });
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFolderDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={!folderName.trim()}
              onClick={() =>
                createFolder({ name: folderName.trim() }).then(() => {
                  setFolderName("");
                  setFolderDialog(false);
                })
              }
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionIcon({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-lg bg-black/60 text-white transition-colors",
        danger ? "hover:bg-rose-500" : "hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}
