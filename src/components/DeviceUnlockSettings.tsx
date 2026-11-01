import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ScanFace } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { clearDeviceUnlock, deviceUnlockSupported, enrollDeviceUnlock, readUnlock } from "@/lib/device-unlock";

export function DeviceUnlockSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    deviceUnlockSupported().then(setSupported);
    supabase.auth.getUser().then(({ data }) => setOn(!!readUnlock(data.user?.id)));
  }, []);
  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (!next) { clearDeviceUnlock(); setOn(false); toast.success("Face ID unlock turned off on this device"); return; }
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in again.");
      await enrollDeviceUnlock(data.user.id, data.user.email ?? "");
      setOn(true); toast.success("Face ID unlock is on for this device");
    } catch (e) {
      toast.error(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Face ID setup was cancelled.");
    } finally { setBusy(false); }
  }
  return <div className="flex items-start justify-between gap-3 rounded-md border p-3">
    <div className="space-y-1"><p className="flex items-center gap-2 font-medium"><ScanFace className="size-4 text-primary" />Unlock with Face ID</p>
      <p className="text-sm text-muted-foreground">{supported === false ? "This device or browser doesn't support Face ID / Touch ID unlock." : "After 15 minutes away, unlock with Face ID or Touch ID instead of signing in again. Applies to this device only."}</p></div>
    <Switch aria-label="Unlock with Face ID" checked={on} disabled={busy || !supported} onCheckedChange={toggle} />
  </div>;
}
