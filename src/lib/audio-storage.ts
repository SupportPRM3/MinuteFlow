import { supabase } from "./supabase";

const BUCKET = "recordings";

export async function saveRecording(meetingId: string, file: File): Promise<void> {
  const ext = file.name.split(".").pop() ?? "m4a";
  await supabase.storage
    .from(BUCKET)
    .upload(`${meetingId}.${ext}`, file, { upsert: true, metadata: { originalName: file.name } });
}

export async function loadRecording(meetingId: string): Promise<{ url: string; name: string } | null> {
  // List objects whose name starts with the meetingId
  const { data: list } = await supabase.storage.from(BUCKET).list("", {
    search: meetingId,
  });
  const obj = list?.find((o) => o.name.startsWith(meetingId));
  if (!obj) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(obj.name);
  // Bucket is private — use a signed URL instead
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(obj.name, 3600); // 1-hour expiry

  if (!signed?.signedUrl) return null;
  return { url: signed.signedUrl, name: obj.name };
}

export async function deleteRecording(meetingId: string): Promise<void> {
  const { data: list } = await supabase.storage.from(BUCKET).list("", { search: meetingId });
  const names = (list ?? []).filter((o) => o.name.startsWith(meetingId)).map((o) => o.name);
  if (names.length) await supabase.storage.from(BUCKET).remove(names);
}
