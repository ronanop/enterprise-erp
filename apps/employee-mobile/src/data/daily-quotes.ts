import type { ImageSourcePropType } from "react-native";

/** Daily motivation quotes for the ESS home horizontal banner. */

export type DailyQuote = {
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
};

/** 10 quotes — each with its own photo; auto-rotates on Home. */
export const DAILY_QUOTES: DailyQuote[] = [
  {
    title: "Make every day count!",
    subtitle: "Stay consistent. Stay productive.",
    image: require("../../assets/images/home/quote-progress.jpg"),
  },
  {
    title: "Small steps, big wins.",
    subtitle: "Progress compounds when you show up.",
    image: require("../../assets/images/home/quote-steps.jpg"),
  },
  {
    title: "Focus on what matters.",
    subtitle: "Clear goals. Calm effort. Better results.",
    image: require("../../assets/images/home/quote-focus.jpg"),
  },
  {
    title: "Your energy sets the tone.",
    subtitle: "Lead your day with intention.",
    image: require("../../assets/images/home/quote-energy.jpg"),
  },
  {
    title: "Consistency beats intensity.",
    subtitle: "One good hour can change everything.",
    image: require("../../assets/images/home/quote-consistency.jpg"),
  },
  {
    title: "Grow a little every day.",
    subtitle: "Skills compound like interest.",
    image: require("../../assets/images/home/quote-grow.jpg"),
  },
  {
    title: "Teamwork makes work lighter.",
    subtitle: "Ask, share, and move forward together.",
    image: require("../../assets/images/home/quote-team.jpg"),
  },
  {
    title: "Own your outcomes.",
    subtitle: "Responsibility unlocks real momentum.",
    image: require("../../assets/images/home/quote-own.jpg"),
  },
  {
    title: "Start before you feel ready.",
    subtitle: "Action creates clarity.",
    image: require("../../assets/images/home/quote-action.jpg"),
  },
  {
    title: "Finish strong today.",
    subtitle: "Tomorrow thanks the work you do now.",
    image: require("../../assets/images/home/quote-finish.jpg"),
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
