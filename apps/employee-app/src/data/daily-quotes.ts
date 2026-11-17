/** Daily motivation quotes for the ESS home horizontal banner. */

export type DailyQuote = {
  title: string;
  subtitle: string;
  /** Illustration shown with this quote (changes with the slide). */
  image: string;
};

/** 10 quotes — each with its own photo; auto-rotates on Home. */
export const DAILY_QUOTES: DailyQuote[] = [
  {
    title: "Make every day count!",
    subtitle: "Stay consistent. Stay productive.",
    image: "/home/quote-progress.jpg",
  },
  {
    title: "Small steps, big wins.",
    subtitle: "Progress compounds when you show up.",
    image: "/home/quote-steps.jpg",
  },
  {
    title: "Focus on what matters.",
    subtitle: "Clear goals. Calm effort. Better results.",
    image: "/home/quote-focus.jpg",
  },
  {
    title: "Your energy sets the tone.",
    subtitle: "Lead your day with intention.",
    image: "/home/quote-energy.jpg",
  },
  {
    title: "Consistency beats intensity.",
    subtitle: "One good hour can change everything.",
    image: "/home/quote-consistency.jpg",
  },
  {
    title: "Grow a little every day.",
    subtitle: "Skills compound like interest.",
    image: "/home/quote-grow.jpg",
  },
  {
    title: "Teamwork makes work lighter.",
    subtitle: "Ask, share, and move forward together.",
    image: "/home/quote-team.jpg",
  },
  {
    title: "Own your outcomes.",
    subtitle: "Responsibility unlocks real momentum.",
    image: "/home/quote-own.jpg",
  },
  {
    title: "Start before you feel ready.",
    subtitle: "Action creates clarity.",
    image: "/home/quote-action.jpg",
  },
  {
    title: "Finish strong today.",
    subtitle: "Tomorrow thanks the work you do now.",
    image: "/home/quote-finish.jpg",
  },
];

/** Stable day index so the featured quote changes daily across the set. */
export function quoteIndexForDate(date = new Date()): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = Math.floor(utc / 86_400_000);
  return ((dayNumber % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length;
}

export function dailyQuoteForDate(date = new Date()): DailyQuote {
  return DAILY_QUOTES[quoteIndexForDate(date)]!;
}
