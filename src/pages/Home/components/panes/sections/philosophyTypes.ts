export interface PhilosophyExampleStyle {
  prompt: string;
  image1: string;
  image2: string;
  video: string;
}

export interface PhilosophyTravelExample {
  id: string;
  label: string;
  images: string[];
  video: string;
  poster: string;
}

export interface PhilosophyAutoAdvance {
  nextAdvanceIdx: number | null;
  prevAdvanceIdx: number | null;
  drainingIdx: number | null;
  videoProgress: number;
  videoEnded: Set<number>;
  videoPlayed: Set<number>;
}

export const PLACEHOLDER_MEDIA = '/placeholder.svg';
