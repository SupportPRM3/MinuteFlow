import { create } from "zustand";
import { Meeting, Folder, ActionItem } from "@/lib/types";
import { mockFolders } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

interface MeetingsState {
  meetings: Meeting[];
  folders: Folder[];
  selectedMeeting: Meeting | null;
  searchQuery: string;
  filterStatus: string;
  filterTeam: string;
  filterDateRange: string;
  hydrated: boolean;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  setSearchQuery: (q: string) => void;
  setFilterStatus: (s: string) => void;
  setFilterTeam: (t: string) => void;
  setFilterDateRange: (d: string) => void;
  toggleFavorite: (id: string) => void;
  updateSpeakerName: (meetingId: string, speakerId: string, name: string) => void;
  updateTranscriptSegment: (meetingId: string, segmentId: string, text: string) => void;
  updateActionItem: (meetingId: string, itemId: string, updates: Partial<ActionItem>) => void;
  addMeeting: (meeting: Meeting) => void;
  updateMeetingStatus: (id: string, status: Meeting["status"], progress?: number) => void;
  updateMinutes: (meetingId: string, minutes: Meeting["minutes"]) => void;
  renameSpeaker: (meetingId: string, speakerId: string, newName: string) => void;
  fetchMeetings: () => Promise<void>;
}

async function syncMeeting(meeting: Meeting) {
  await supabase
    .from("meetings")
    .upsert({ id: meeting.id, data: meeting }, { onConflict: "id" });
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  meetings: [],
  folders: mockFolders,
  selectedMeeting: null,
  searchQuery: "",
  filterStatus: "all",
  filterTeam: "all",
  filterDateRange: "all",
  hydrated: false,

  fetchMeetings: async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("data")
      .order("created_at", { ascending: false });
    if (!error && data) {
      set({ meetings: data.map((row) => row.data as Meeting), hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  setSelectedMeeting: (meeting) => set({ selectedMeeting: meeting }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterStatus: (s) => set({ filterStatus: s }),
  setFilterTeam: (t) => set({ filterTeam: t }),
  setFilterDateRange: (d) => set({ filterDateRange: d }),

  toggleFavorite: (id) => {
    set((state) => {
      const meetings = state.meetings.map((m) =>
        m.id === id ? { ...m, isFavorite: !m.isFavorite } : m
      );
      const updated = meetings.find((m) => m.id === id);
      if (updated) syncMeeting(updated);
      return { meetings };
    });
  },

  updateSpeakerName: (meetingId, speakerId, name) => {
    set((state) => {
      const meetings = state.meetings.map((m) =>
        m.id === meetingId
          ? { ...m, speakers: m.speakers?.map((s) => s.id === speakerId ? { ...s, name } : s) }
          : m
      );
      const updated = meetings.find((m) => m.id === meetingId);
      if (updated) syncMeeting(updated);
      return { meetings };
    });
  },

  renameSpeaker: (meetingId, speakerId, newName) => {
    set((state) => {
      const meetings = state.meetings.map((m) => {
        if (m.id !== meetingId) return m;
        const oldSpeaker = m.speakers?.find((s) => s.id === speakerId);
        if (!oldSpeaker) return m;
        return {
          ...m,
          speakers: m.speakers?.map((s) => s.id === speakerId ? { ...s, name: newName } : s),
          participants: m.participants.map((p) => p === oldSpeaker.name ? newName : p),
        };
      });
      const updated = meetings.find((m) => m.id === meetingId);
      if (updated) syncMeeting(updated);
      return { meetings };
    });
  },

  updateTranscriptSegment: (meetingId, segmentId, text) => {
    set((state) => {
      const meetings = state.meetings.map((m) =>
        m.id === meetingId
          ? { ...m, transcript: m.transcript?.map((t) => t.id === segmentId ? { ...t, text } : t) }
          : m
      );
      const updated = meetings.find((m) => m.id === meetingId);
      if (updated) syncMeeting(updated);
      return { meetings };
    });
  },

  updateActionItem: (meetingId, itemId, updates) => {
    set((state) => {
      const meetings = state.meetings.map((m) =>
        m.id === meetingId
          ? { ...m, actionItems: m.actionItems?.map((a) => a.id === itemId ? { ...a, ...updates } : a) }
          : m
      );
      const updated = meetings.find((m) => m.id === meetingId);
      if (updated) syncMeeting(updated);
      return { meetings };
    });
  },

  addMeeting: (meeting) => {
    set((state) => ({ meetings: [meeting, ...state.meetings] }));
    syncMeeting(meeting);
  },

  updateMinutes: (meetingId, minutes) => {
    set((state) => {
      const meetings = state.meetings.map((m) =>
        m.id === meetingId ? { ...m, minutes } : m
      );
      const updated = meetings.find((m) => m.id === meetingId);
      if (updated) syncMeeting(updated);
      return { meetings };
    });
  },

  updateMeetingStatus: (id, status, progress) => {
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m.id === id ? { ...m, status, processingProgress: progress ?? m.processingProgress } : m
      ),
    }));
  },
}));
