export type ProcessingStatus = "uploading" | "transcribing" | "detecting_speakers" | "generating_summary" | "creating_minutes" | "completed" | "failed";

export interface Speaker {
  id: string;
  name: string;
  color: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "completed";
  notes?: string;
}

export interface MeetingMinutes {
  title: string;
  date: string;
  time: string;
  duration: string;
  participants: string[];
  objectives: string[];
  agenda: string[];
  discussionSummary: string;
  decisions: string[];
  actionItems: ActionItem[];
  risks: string[];
  followUpItems: string[];
  nextMeeting?: string;
  preparedBy: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number; // seconds
  participants: string[];
  status: ProcessingStatus;
  tags: string[];
  recordingUrl?: string;
  transcript?: TranscriptSegment[];
  speakers?: Speaker[];
  minutes?: MeetingMinutes;
  summaries?: {
    executive: string;
    bullet: string;
    detailed: string;
    oneSentence: string;
    clientFriendly: string;
    management: string;
  };
  actionItems?: ActionItem[];
  createdBy: string;
  isFavorite: boolean;
  folderId?: string;
  team?: string;
  processingProgress?: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  meetingCount: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
