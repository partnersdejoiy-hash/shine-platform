import { api } from "@/convex/api";
import { ACCENTS, DEFAULT_ACCENT_ID, applyAccent, getAccent } from "@/lib/accent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { prepareAvatarImage, uploadBlob, uploadFile } from "@/lib/upload";
import { SOUND_CHOICES, SOUND_EVENTS, playEventSound, previewSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errors";
import { useAction, useMutation, useQuery } from "@/convex/react";
import {
  Accessibility,
  Bell,
  Camera,
  Check,
  Command,
  CreditCard,
  Crown,
  Fingerprint,
  ImagePlus,
  Keyboard,
  Laptop,
  Loader2,
  Mic,
  Monitor,
  Moon,
  Palette,
  Play,
  ReceiptText,
  RotateCcw,
  Save,
  ShieldCheck,
  KeyRound,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ThemeMode = "dark" | "light" | "system";

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "meeting", label: "In a meeting" },
  { value: "focus", label: "Focusing" },
  { value: "do_not_disturb", label: "Do not disturb" },
  { value: "offline", label: "Offline" },
] as const;

const DEFAULT_PREFS = {
  mentions: true,
  directMessages: true,
  groupMessages: true,
  calls: true,
  meetings: true,
  announcements: true,
  sound: true,
  desktop: true,
};
type PrefKey = keyof typeof DEFAULT_PREFS;

const NOTIF_ROWS: { key: PrefKey; label: string; desc: string }[] = [
  { key: "mentions", label: "Mentions", desc: "When someone @mentions you" },
  { key: "directMessages", label: "Direct messages", desc: "New 1:1 conversations" },
  { key: "groupMessages", label: "Group & channel messages", desc: "Activity in groups and channels" },
  { key: "calls", label: "Calls", desc: "Incoming audio and video calls" },
  { key: "meetings", label: "Meetings", desc: "Meeting invites and reminders" },
  { key: "announcements", desc: "Broadcast and announcement channels", label: "Announcements" },
];

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Cmd", "K"], label: "Global search" },
  { keys: ["Cmd", "Shift", "A"], label: "Open Shine AI" },
  { keys: ["Cmd", "N"], label: "New chat" },
  { keys: ["Cmd", "Shift", "M"], label: "Toggle mute" },
  { keys: ["Esc"], label: "Close dialogs / dismiss" },
  { keys: ["Shift", "Enter"], label: "New line in composer" },
  { keys: ["Enter"], label: "Send message" },
  { keys: ["Up"], label: "Edit last message" },
];

export function AppSettings() {
  const { user, isLoading } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);
  const setAccentColor = useMutation(api.users.setAccentColor);
  const setNotificationPrefs = useMutation(api.users.setNotificationPrefs);
  const setSoundPrefs = useMutation(api.users.setSoundPrefs);
  const myDevices = useQuery(api.users.myDevices);
  const setDeviceTrusted = useMutation(api.users.setDeviceTrusted);
  const removeDevice = useMutation(api.users.removeDevice);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateAvatar = useMutation(api.users.updateAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);
  const myPermissionRequests = useQuery(api.admin.myPermissionRequests);
  const requestPermission = useMutation(api.admin.requestPermission);
  const hasPassword = useQuery(api.passwords.hasPassword);
  const setMyPassword = useMutation(api.passwords.setMyPassword);
  const billing = useQuery(api.billing.billingOverview);
  const plansInfo = useQuery(api.billing.plans);
  const createOrder = useAction(api.billingNode.createOrder);
  const verifyPayment = useAction(api.billingNode.verifyPayment);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // profile form state
  const [form, setForm] = useState({
    name: "",
    designation: "",
    department: "",
    company: "",
    location: "",
    timezone: "",
    employeeId: "",
    phone: "",
    bio: "",
    skills: "",
    customStatus: "",
    availability: "available" as string,
  });

  // theme state
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("shine-theme");
      if (saved === "dark" || saved === "light" || saved === "system") return saved;
    } catch { /* ignore */ }
    return "system";
  });

  // notification prefs
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS });

  // per-event sounds (soundPrefs[event] = "off" | builtin id | "custom")
  const [soundMap, setSoundMap] = useState<Record<string, string>>({});
  const [customSoundUrl, setCustomSoundUrl] = useState<string | null>(null);
  const [soundBusy, setSoundBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // permission request form
  const [permName, setPermName] = useState("");
  const [permReason, setPermReason] = useState("");
  const [permDays, setPermDays] = useState("");
  const [requesting, setRequesting] = useState(false);

  // password form
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? "",
      designation: user.designation ?? "",
      department: user.department ?? "",
      company: user.company ?? "",
      location: user.location ?? "",
      timezone: user.timezone ?? "",
      employeeId: user.employeeId ?? "",
      phone: user.phone ?? "",
      bio: user.bio ?? "",
      skills: (user.skills ?? []).join(", "),
      customStatus: user.customStatus ?? "",
      availability: user.availability ?? "available",
    });
    if (user.notificationPrefs) setPrefs({ ...prefs, ...user.notificationPrefs });
    if (user.soundPrefs) setSoundMap(user.soundPrefs);
    setCustomSoundUrl(user.customSoundUrl ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const dirty = useMemo(() => {
    if (!user) return false;
    return (
      form.name !== (user.name ?? "") ||
      form.designation !== (user.designation ?? "") ||
      form.department !== (user.department ?? "") ||
      form.company !== (user.company ?? "") ||
      form.location !== (user.location ?? "") ||
      form.timezone !== (user.timezone ?? "") ||
      form.employeeId !== (user.employeeId ?? "") ||
      form.phone !== (user.phone ?? "") ||
      form.bio !== (user.bio ?? "") ||
      form.skills !== (user.skills ?? []).join(", ") ||
      form.customStatus !== (user.customStatus ?? "") ||
      form.availability !== (user.availability ?? "available")
    );
  }, [form, user]);

  const applyTheme = (t: ThemeMode) => {
    setThemeState(t);
    let isDark = t === "dark";
    if (t === "system") {
      isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("shine-theme", t);
    } catch {
      /* ignore */
    }
    applyAccent(user?.accentColor ?? null);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image must be under 15 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      // Decode + downscale/convert client-side so HEIC and huge phone photos
      // upload reliably and always render in every browser.
      const ready = await prepareAvatarImage(file);
      const { storageId, url } = await uploadFile(ready, () => generateUploadUrl());
      await updateAvatar({ storageId, url });
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(getFriendlyError(err) || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar();
      toast.success("Profile picture removed");
    } catch (e) {
      toast.error(getFriendlyError(e) || "Failed to remove picture");
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim() || undefined,
        designation: form.designation.trim() || undefined,
        department: form.department.trim() || undefined,
        company: form.company.trim() || undefined,
        location: form.location.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        employeeId: form.employeeId.trim() || undefined,
        phone: form.phone.trim() || undefined,
        bio: form.bio.trim() || undefined,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        customStatus: form.customStatus.trim() || undefined,
        availability: form.availability as any,
      });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(getFriendlyError(e) || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setPwBusy(true);
    try {
      await setMyPassword({
        currentPassword: hasPassword === false ? undefined : pwCurrent || undefined,
        newPassword: pwNew,
      });
      toast.success(
        hasPassword === false
          ? "Password created — sign in with email + password anytime"
          : "Password updated",
      );
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch (e) {
      toast.error(getFriendlyError(e) || "Failed to update password");
    } finally {
      setPwBusy(false);
    }
  };

  const savePrefs = async (next: typeof prefs) => {
    setPrefs(next);
    try {
      await setNotificationPrefs({ prefs: next });
    } catch (e) {
      toast.error(getFriendlyError(e) || "Failed to save preferences");
    }
  };

  const saveSound = async (next: Record<string, string>) => {
    setSoundMap(next);
    try {
      await setSoundPrefs({ soundPrefs: next, customSoundUrl: customSoundUrl ?? undefined });
    } catch (e) {
      toast.error(getFriendlyError(e) || "Failed to save sound settings");
    }
  };

  const uploadCustomSound = async (blob: Blob) => {
    setSoundBusy(true);
    try {
      const up = await uploadBlob(
        blob,
        "custom-notification-sound.webm",
        blob.type || "audio/webm",
        generateUploadUrl,
      );
      const url = up.url ?? "";
      setCustomSoundUrl(url || null);
      await setSoundPrefs({
        soundPrefs: { ...soundMap, message: "custom" },
        customSoundUrl: url || undefined,
      });
      setSoundMap({ ...soundMap, message: "custom" });
      toast.success("Custom sound saved — Direct message is now set to “My sound”");
    } catch (e) {
      toast.error(getFriendlyError(e) || "Upload failed");
    } finally {
      setSoundBusy(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) await uploadCustomSound(blob);
      };
      mediaRecRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied — use the upload option instead");
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
  };

  const previewEvent = (evKey: string) => {
    const choice = soundMap[evKey] ?? "default";
    if (choice === "custom") {
      if (!customSoundUrl) {
        toast.error("Upload or record a custom sound first");
        return;
      }
      try {
        new Audio(customSoundUrl).play().catch(() => {});
      } catch {
        /* ignore */
      }
    } else {
      previewSound(choice === "off" ? "default" : choice);
    }
  };

  const currentDeviceName =
    typeof navigator !== "undefined"
      ? `${navigator.platform ?? "Device"} · ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop"}`
      : "This device";

  const handleCheckout = async (planCode: string) => {
    try {
      setCheckoutPlan(planCode);
      const order = await createOrder({ planCode });
      const RazorpayCtor = await loadRazorpayCheckout();
      const rzp = new RazorpayCtor({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "SHINE",
        description: "Enterprise collaboration · Powered by DEJOIY",
        order_id: order.orderId,
        handler: async (res: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPayment({
              orderId: res.razorpay_order_id,
              paymentId: res.razorpay_payment_id,
              signature: res.razorpay_signature,
            });
            toast.success("Payment verified — your plan is active");
          } catch (e) {
            toast.error(getFriendlyError(e) || "Payment could not be verified");
          }
        },
        prefill: { email: user?.email, name: user?.name },
        theme: { color: "#D4AF37" },
      });
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. You can try again anytime.");
      });
      rzp.open();
    } catch (e) {        toast.error(getFriendlyError(e) || "Could not start checkout");
    } finally {
      setCheckoutPlan(null);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your profile, appearance, notifications and security.
          </p>
        </div>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">
              <UserRound className="size-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="size-3.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="size-3.5" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="security">
              <ShieldCheck className="size-3.5" /> Security
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <Keyboard className="size-3.5" /> Shortcuts
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="size-3.5" /> Billing
            </TabsTrigger>
          </TabsList>

          {/* ---- Profile ---- */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Profile</CardTitle>
                <CardDescription>
                  Shown across the workspace — in chats, calls, meetings and the directory.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {/* Profile picture */}
                <div className="sm:col-span-2 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/80 bg-background/40 p-6 sm:flex-row sm:items-center">
                  <div className="group relative shrink-0">
                    <UserAvatar user={user} size="xl" className="ring-2 ring-primary/25" />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      title="Change profile picture"
                      className="absolute inset-0 grid place-items-center rounded-full bg-black/60 opacity-0 outline-none transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Camera className="size-5 text-white" />
                    </button>
                    {uploadingAvatar && (
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 backdrop-blur-sm">
                        <Loader2 className="size-5 animate-spin text-primary" />
                      </span>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarFile}
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <div className="text-sm font-semibold">{user.name || "Your name"}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      JPG, PNG or WebP · up to 5 MB. Visible to everyone across SHINE — chats, calls, meetings and the directory.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                      {user.role === "super_admin" && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Super admin
                        </span>
                      )}
                      {user.designation && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                          {user.designation}
                        </span>
                      )}
                      {user.company && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                          {user.company}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={uploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        <ImagePlus className="size-3.5" />
                        {user.image ? "Change photo" : "Upload photo"}
                      </Button>
                      {user.image && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                          disabled={uploadingAvatar}
                          onClick={handleRemoveAvatar}
                        >
                          <Trash2 className="size-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 grid gap-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Staff Engineer"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Platform"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="e.g. DEJOIY"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="e.g. DJ-0042"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 000 1234"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="availability">Availability</Label>
                  <Select value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v })}>
                    <SelectTrigger id="availability" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 grid gap-2">
                  <Label htmlFor="customStatus">Custom status</Label>
                  <Input
                    id="customStatus"
                    value={form.customStatus}
                    onChange={(e) => setForm({ ...form, customStatus: e.target.value })}
                    placeholder="e.g. Shipping SHINE v1 🚀"
                    maxLength={64}
                  />
                </div>
                <div className="sm:col-span-2 grid gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="A few words about what you do"
                  />
                </div>
                <div className="sm:col-span-2 grid gap-2">
                  <Label htmlFor="skills">Skills (comma separated)</Label>
                  <Input
                    id="skills"
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                    placeholder="TypeScript, React, Real-time systems"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={saveProfile} disabled={!dirty || saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Appearance ---- */}
          <TabsContent value="appearance" className="mt-4 space-y-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Theme</CardTitle>
                <CardDescription>SHINE ships with a premium gold-on-black theme and a light alternative.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      mode: "dark",
                      icon: Moon,
                      title: "Midnight gold",
                      desc: "Black glassmorphism with gold accents — the DEJOIY signature.",
                      preview: "bg-[#0B0B0B]",
                    },
                    {
                      mode: "light",
                      icon: Sun,
                      title: "Pearl",
                      desc: "Clean, quiet and bright for daylight work.",
                      preview: "bg-[#f7f6f2]",
                    },
                    {
                      mode: "system",
                      icon: Monitor,
                      title: "System",
                      desc: "Follows your device dark/light preference.",
                      preview: "bg-gradient-to-br from-[#0B0B0B] to-[#f7f6f2]",
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.mode}
                    onClick={() => applyTheme(t.mode)}
                    className={cn(
                      "group rounded-2xl border p-4 text-left transition-all",
                      theme === t.mode
                        ? "border-primary/60 bg-primary/10 ring-glow"
                        : "border-border hover:border-primary/40 hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "grid size-10 place-items-center rounded-xl border border-border",
                          t.preview,
                          t.mode === "dark" ? "text-[#D4AF37]" : "text-[#0B0B0B]",
                        )}
                      >
                        <t.icon className="size-5" />
                      </div>
                      {theme === t.mode && (
                        <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-sm font-semibold">{t.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                  </button>
                ))}

                <div className="sm:col-span-2 rounded-2xl border border-dashed border-border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-4 text-primary" />
                    App color
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick your personal app color — SHINE's logo, buttons, glows and animations
                    follow it. Saved to your account, so it stays the same on every device until
                    you change it.
                  </p>
                  <div className="mt-4 grid grid-cols-5 gap-2.5 sm:grid-cols-10">
                    {ACCENTS.map((accent) => {
                      const selected = (user.accentColor ?? DEFAULT_ACCENT_ID) === accent.id;
                      return (
                        <button
                          key={accent.id}
                          type="button"
                          title={accent.label}
                          aria-label={`Set app color to ${accent.label}`}
                          onClick={async () => {
                            applyAccent(accent.id);
                            try {
                              await setAccentColor({ accentColor: accent.id });
                              toast.success(`App color set to ${accent.label}`);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed to save color");
                            }
                          }}
                          className={cn(
                            "group relative aspect-square rounded-full transition-all duration-200",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            selected
                              ? "scale-105 ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
                              : "hover:scale-110 hover:ring-2 hover:ring-foreground/30",
                          )}
                          style={{ background: accent.swatch }}
                        >
                          {selected && (
                            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-black/80">
                              <Check className="size-3.5" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className="inline-block size-3.5 rounded-full"
                      style={{ background: getAccent(user.accentColor).swatch }}
                    />
                    <span className="text-xs font-medium">
                      {getAccent(user.accentColor).label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — applies to the whole app, all roles.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Accessibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingRow
                  icon={Accessibility}
                  title="Reduced motion"
                  desc="Minimize animations and transitions across the app."
                  control={
                    <Switch
                      checked={prefs.sound}
                      onCheckedChange={(v) => {
                        const next = { ...prefs, sound: v };
                        setPrefs(next);
                      }}
                    />
                  }
                />
                <SettingRow
                  icon={Fingerprint}
                  title="Biometric unlock"
                  desc="Unlock SHINE with Face ID or fingerprint on supported devices."
                  control={
                    <Switch
                      checked={false}
                      onCheckedChange={() =>
                        toast.info("Biometric unlock requires a trusted device and enterprise enrollment.")
                      }
                    />
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Notifications ---- */}
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
                <CardDescription>Choose which events are worth your attention.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {NOTIF_ROWS.map((row) => (
                  <SettingRow
                    key={row.key}
                    icon={Bell}
                    title={row.label}
                    desc={row.desc}
                    control={
                      <Switch
                        checked={prefs[row.key]}
                        onCheckedChange={(v) => savePrefs({ ...prefs, [row.key]: v })}
                      />
                    }
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-semibold">Sounds</CardTitle>
                  <CardDescription>
                    Pick a sound for every event — or record your own voice as your
                    notification sound.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="size-4 text-muted-foreground" />
                  <Switch
                    checked={prefs.sound}
                    onCheckedChange={(v) => savePrefs({ ...prefs, sound: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingRow
                  icon={Monitor}
                  title="Desktop notifications"
                  desc="System-level notifications while SHINE runs in the background."
                  control={
                    <Switch
                      checked={prefs.desktop}
                      onCheckedChange={(v) => savePrefs({ ...prefs, desktop: v })}
                    />
                  }
                />

                <div className="my-3 h-px bg-border/60" />

                {SOUND_EVENTS.map((ev) => (
                  <div
                    key={ev.key}
                    className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{ev.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{ev.desc}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title="Preview this sound"
                        onClick={() => previewEvent(ev.key)}
                      >
                        <Play className="size-3.5" />
                      </Button>
                      <Select
                        value={soundMap[ev.key] ?? "default"}
                        onValueChange={(v) => saveSound({ ...soundMap, [ev.key]: v })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Off</SelectItem>
                          {SOUND_CHOICES.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                <div className="my-3 h-px bg-border/60" />

                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    <Mic className="size-4 text-primary" />
                    <span className="text-sm font-medium">My own sound</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Record a short voice message or upload an audio file. After saving,
                    set any event to “My sound”.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={soundBusy}
                      onClick={() => (recording ? stopRecording() : startRecording())}
                    >
                      {recording ? (
                        <>
                          <span className="size-2 animate-pulse rounded-full bg-destructive" />
                          Stop recording
                        </>
                      ) : (
                        <>
                          <Mic className="size-3.5" />
                          Record voice
                        </>
                      )}
                    </Button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted/60">
                      <Upload className="size-3.5" />
                      {soundBusy ? "Uploading…" : "Upload audio"}
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadCustomSound(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {customSoundUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => {
                          try {
                            new Audio(customSoundUrl).play().catch(() => {});
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        <Play className="size-3.5" />
                        Play mine
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Security ---- */}
          <TabsContent value="security" className="mt-4 space-y-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Devices &amp; sessions</CardTitle>
                <CardDescription>
                  Devices signed into your account. Untrusted devices can be revoked at any time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(myDevices ?? []).map((d) => (
                  <div key={d._id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      {(d.platform ?? "").toLowerCase().includes("mobile") ? (
                        <Smartphone className="size-4" />
                      ) : (
                        <Laptop className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{d.name}</span>
                        {d.isCurrent === true && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.platform ?? "Unknown platform"} · active {timeAgo(d.lastActiveAt)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() =>
                        setDeviceTrusted({ deviceId: d._id, trusted: !d.isTrusted }).catch(() => {})
                      }
                    >
                      {d.isTrusted ? "Untrust" : "Trust"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        removeDevice({ deviceId: d._id })
                          .then(() => toast.success("Device revoked"))
                          .catch(() => {})
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {!myDevices && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {myDevices && myDevices.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No registered devices. This one ({currentDeviceName}) will appear here on next launch.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Account security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  icon={ShieldCheck}
                  title="Two-factor authentication"
                  desc="One-time codes via email OTP are already enabled for your account."
                  control={
                    <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                      Enabled
                    </span>
                  }
                />
                <SettingRow
                  icon={Command}
                  title="Enterprise SSO"
                  desc="Configured by your workspace administrator through SAML / OIDC."
                  control={
                    <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-medium text-primary">
                      Org managed
                    </span>
                  }
                />
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Password &amp; sign-in</CardTitle>
                <CardDescription>
                  {hasPassword === false
                    ? "You haven't set a password yet. Create one to sign in with your email and password instead of a code every time."
                    : "Sign in anywhere with your email and password — or keep using email verification codes."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasPassword !== false && (
                  <div className="grid gap-2">
                    <Label htmlFor="pwCurrent">Current password</Label>
                    <Input
                      id="pwCurrent"
                      type="password"
                      autoComplete="current-password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      placeholder="Your current password"
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="pwNew">New password</Label>
                    <Input
                      id="pwNew"
                      type="password"
                      autoComplete="new-password"
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pwConfirm">Confirm new password</Label>
                    <Input
                      id="pwConfirm"
                      type="password"
                      autoComplete="new-password"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      placeholder="Repeat the password"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters. A mix of letters, numbers and symbols is recommended.
                  </p>
                  <Button
                    className="shrink-0 gap-1.5"
                    disabled={
                      pwBusy ||
                      pwNew.length < 8 ||
                      pwNew !== pwConfirm ||
                      (hasPassword !== false && !pwCurrent)
                    }
                    onClick={savePassword}
                  >
                    {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                    {hasPassword === false ? "Create password" : "Update password"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Request access</CardTitle>
                <CardDescription>
                  Need a permission your role doesn't include? Request it — Super Admins,
                  Administrators and the IT team review requests from the Admin console.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="permName">Permission</Label>
                    <Select value={permName} onValueChange={setPermName}>
                      <SelectTrigger id="permName" className="w-full">
                        <SelectValue placeholder="Select a permission" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create_group_chats">Create group chats</SelectItem>
                        <SelectItem value="create_channels">Create channels</SelectItem>
                        <SelectItem value="schedule_meetings">Schedule meetings</SelectItem>
                        <SelectItem value="start_meetings">Start meetings</SelectItem>
                        <SelectItem value="invite_members">Invite members</SelectItem>
                        <SelectItem value="broadcast_announcements">Send announcements</SelectItem>
                        <SelectItem value="export_reports">Export reports</SelectItem>
                        <SelectItem value="manage_tasks">Manage tasks</SelectItem>
                        <SelectItem value="custom">Other (type below)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="permDays">Duration (days, optional)</Label>
                    <Input
                      id="permDays"
                      type="number"
                      min={1}
                      value={permDays}
                      onChange={(e) => setPermDays(e.target.value)}
                      placeholder="Permanent if empty"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="permReason">Reason</Label>
                  <Textarea
                    id="permReason"
                    rows={2}
                    value={permReason}
                    onChange={(e) => setPermReason(e.target.value)}
                    placeholder="Why do you need this access?"
                  />
                </div>
                <Button
                  className="gap-1.5"
                  disabled={requesting || !permName.trim()}
                  onClick={async () => {
                    setRequesting(true);
                    try {
                      const days = parseInt(permDays, 10);
                      await requestPermission({
                        permission: permName,
                        reason: permReason.trim() || undefined,
                        durationDays: Number.isFinite(days) && days > 0 ? days : undefined,
                      });
                      setPermName("");
                      setPermReason("");
                      setPermDays("");
                      toast.success("Request submitted — an admin or the IT team will review it");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to submit request");
                    } finally {
                      setRequesting(false);
                    }
                  }}
                >
                  {requesting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Submit request
                </Button>

                {(myPermissionRequests ?? []).length > 0 && (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <div className="text-xs font-semibold text-muted-foreground">My requests</div>
                    {(myPermissionRequests ?? []).map((r) => (
                      <div key={r._id} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs">
                        <span className="font-mono text-[11px]">{r.permission}</span>
                        <Badge
                          className={cn(
                            r.status === "pending" && "bg-amber-500/15 text-amber-400",
                            r.status === "approved" && "bg-emerald-500/15 text-emerald-400",
                            r.status === "rejected" && "bg-rose-500/15 text-rose-400",
                          )}
                        >
                          {r.status}
                        </Badge>
                        <span className="ml-auto text-muted-foreground">{timeAgo(r.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Billing ---- */}
          <TabsContent value="billing" className="mt-4 space-y-4">
            {billing?.configured === false && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <CreditCard className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <p className="text-sm text-amber-200/90">
                  Razorpay isn't configured for this deployment yet. A workspace admin needs to add{" "}
                  <span className="font-mono text-[11px] text-amber-100">RAZORPAY_KEY_ID</span> and{" "}
                  <span className="font-mono text-[11px] text-amber-100">RAZORPAY_KEY_SECRET</span> in the
                  project's Keys tab to enable payments.
                </p>
              </div>
            )}

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Current plan</CardTitle>
                <CardDescription>
                  Your organization's active SHINE license and recent payment activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] p-4">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Crown className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {currentPlanLabel(billing?.plan ?? "free", plansInfo?.plans ?? [])}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {billing?.plan === "enterprise"
                        ? "Enterprise licensing — custom SLA & onboarding"
                        : "Renews monthly · manage billing from this screen"}
                    </p>
                  </div>
                  <Badge className="bg-primary/15 font-semibold text-primary">
                    {(billing?.plan ?? "free").toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-semibold">Plans &amp; licensing</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Secure payments via Razorpay (UPI, cards, net-banking, wallets). Upgrades apply to your
                organization immediately after verification.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(plansInfo?.plans ?? []).map((plan) => {
                const isCurrent = billing?.plan === plan.code;
                const isEnterprise = plan.price <= 0;
                const busy = checkoutPlan === plan.code;
                return (
                  <div
                    key={plan.code}
                    className={cn(
                      "flex flex-col rounded-2xl border p-4 transition-all",
                      isCurrent
                        ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/20"
                        : "border-border/80 hover:border-primary/35",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold">{plan.name}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{plan.tagline}</p>
                      </div>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-xl font-bold tracking-tight">
                      {isEnterprise ? "Custom" : formatPrice(plan.price, plan.currency)}
                      {!isEnterprise && <span className="text-xs font-normal text-muted-foreground"> / month</span>}
                    </div>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-4 gap-1.5"
                      size="sm"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || isEnterprise || busy || billing?.configured === false}
                      onClick={() => handleCheckout(plan.code)}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : isEnterprise ? (
                        <>
                          <Sparkles className="size-3.5" /> Contact sales
                        </>
                      ) : isCurrent ? (
                        "Current plan"
                      ) : (
                        <>
                          <CreditCard className="size-3.5" /> Upgrade
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ReceiptText className="size-4 text-primary" /> Payment history
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {billing === undefined && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {billing != null && billing.history.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No payments yet. Upgrade to a paid plan to see receipts here.
                  </p>
                )}
                {(billing?.history ?? []).map((p) => (
                  <div
                    key={p._id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/80 text-muted-foreground">
                      <ReceiptText className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{p.planName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{p.orderId}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatPrice(p.amount, p.currency)}</div>
                    <Badge
                      className={cn(
                        p.status === "paid" && "bg-emerald-500/15 text-emerald-400",
                        p.status === "created" && "bg-amber-500/15 text-amber-400",
                        (p.status === "failed" || p.status === "refunded") && "bg-rose-500/15 text-rose-400",
                      )}
                    >
                      {p.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Payments are processed securely by Razorpay. SHINE never stores card details.
            </p>
          </TabsContent>

          {/* ---- Shortcuts ---- */}
          <TabsContent value="shortcuts" className="mt-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Keyboard shortcuts</CardTitle>
                <CardDescription>Move fast, stay in flow.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border/60">
                {SHORTCUTS.map((s) => (
                  <div key={s.label} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-md border border-border bg-accent/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function loadRazorpayCheckout(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve((window as any).Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve((window as any).Razorpay);
    s.onerror = () => reject(new Error("Could not load the Razorpay checkout — check your connection."));
    document.head.appendChild(s);
  });
}

function formatPrice(paise: number, currency: string) {
  const amount = paise / 100;
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function currentPlanLabel(
  code: string,
  plans: { code: string; name: string }[],
) {
  const plan = plans.find((p) => p.code === code);
  return plan?.name ?? code.charAt(0).toUpperCase() + code.slice(1);
}

function SettingRow({
  icon: Icon,
  title,
  desc,
  control,
}: {
  icon: typeof Bell;
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent/80 text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
