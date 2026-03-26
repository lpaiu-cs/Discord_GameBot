export interface Seat {
  seat: number;
  empty: boolean;
  userId?: string;
  isViewer?: boolean;
  alive?: boolean;
  displayName?: string;
  bullied?: boolean;
  ascended?: boolean;
}

export interface RoomState {
  gameId: string;
  phase: string;
  phaseLabel: string;
  dayNumber: number;
  nightNumber: number;
  deadlineAt?: number | null;
  seats: Seat[];
  currentTrialTargetName?: string;
}

export interface ViewerState {
  userId: string;
  role: string;
  roleLabel: string;
  roleSummary: string;
  teamLabel: string;
  alive: boolean;
  loverName?: string;
  deadReason?: string;
  ascended?: boolean;
}

export interface ActionControl {
  type: "info" | "button" | "buttons" | "grid";
  title: string;
  description: string;
  actionType: string;
  action?: string;
  buttons?: { label: string; value: string }[];
  options?: { value: string }[];
  currentValue?: string;
  currentLabel?: string;
}

export interface ChatMessage {
  id: string;
  kind: "system" | "player";
  content: string;
  authorId?: string;
  authorName?: string;
  createdAt: number;
}

export interface ChatThread {
  channel: string;
  title: string;
  canWrite: boolean;
  messages: ChatMessage[];
}

export interface SystemLogLine {
  createdAt: number;
  line: string;
}

export interface EndedSummary {
  viewerResultLabel?: string;
  winnerLabel?: string;
  reason?: string;
  revealedPlayers: any[];
}

export interface AudioCue {
  id: string;
  key: string;
  createdAt: number;
}

export interface GameState {
  room: RoomState;
  viewer: ViewerState;
  actions: {
    notices: string[];
    controls: ActionControl[];
  };
  publicChat: ChatThread;
  secretChats: ChatThread[];
  systemLog: {
    privateLines: SystemLogLine[];
  };
  endedSummary?: EndedSummary;
  audioCues?: AudioCue[];
}

export interface InitialPayload {
  version: number;
  serverNow: number;
  room: RoomState;
}

export interface DashboardStatePayload {
  version: number;
  serverNow: number;
  state: GameState;
}
