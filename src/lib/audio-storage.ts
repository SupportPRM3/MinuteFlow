import { supabase } from "./supabase";

const BUCKET = "recordings";

// Uploads the file to storage (this becomes the permanently saved recording)
// and returns a signed URL the server can download it from for processing.
export async function uploadRecordingForProcessing(meetingId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "m4a";
  const path = `${meetingId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, metadata: { originalName: file.name } });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600); // 1-hour expiry — only needs to live long enough for the server to fetch it
  if (signError || !signed?.signedUrl) throw new Error("Could not generate a file URL for processing");

  return signed.signedUrl;
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
