export interface BookData {
  title: string;
  author: string;
  genre: string;
  description: string;
  pages: number;
  ageRating: string;
  rating?: number;
  reviewCount?: number;
  authorBio?: string;
  coverUrl?: string;
}

export interface SlideContent {
  type: 'hook' | 'audience' | 'about' | 'author' | 'specs' | 'cta';
  headline?: string;
  subheadline?: string;
  bullets?: string[];
  quote?: string;
  backgroundUrl?: string;
}

export interface Project {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'analyzing' | 'generating' | 'ready';

  // Input
  rideroUrl: string;
  coverUrl: string;

  // Parsed data
  bookData?: BookData;

  // AI Analysis
  analysis?: {
    hook: string;
    audience: string[];
    tone: 'dark' | 'light' | 'neutral';
  };

  // Generated content
  slides: SlideContent[];

  // Fonts
  fonts: {
    headline: string;
    body: string;
  };

  // Exports
  exports?: {
    png: string[];
    generatedAt: string;
  };
}

export interface WizardStep {
  id: string;
  question: string;
  options?: string[];
  value?: string;
  editable?: boolean;
}
