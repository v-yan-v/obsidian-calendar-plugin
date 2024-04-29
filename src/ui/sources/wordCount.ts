import type { Moment } from "moment";
import type { CachedMetadata, TFile } from "obsidian";
import { getAllTags } from "obsidian";
import type { ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { getDailyNote, getWeeklyNote } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { DEFAULT_WORDS_PER_DOT } from "src/constants";

import { dailyNotes, settings, weeklyNotes } from "../stores";
import { clamp, getWordCount } from "../utils";

const NUM_MAX_DOTS = 5;

export async function getWordLengthAsDots(note: TFile): Promise<number> {
  const { wordsPerDot = DEFAULT_WORDS_PER_DOT } = get(settings);
  if (!note || wordsPerDot <= 0) {
    return 0;
  }
  const fileContents = await window.app.vault.cachedRead(note);

  const wordCount = getWordCount(fileContents);
  const numDots = wordCount / wordsPerDot;
  return clamp(Math.floor(numDots), 1, NUM_MAX_DOTS);
}

async function isNoteHasSpecifiedTag(fileCache: CachedMetadata | null, tag: string): Promise<boolean> {
  if (!fileCache || !tag) {
    return false;
  }

  const tags = getAllTags(fileCache)
  // console.log(tags);

  return tags.some(t => t === tag)
}

async function isSpecifiedHeadingSectionHasContent(fileCache: CachedMetadata, headingName: string): Promise<boolean> {
  if (!fileCache || !headingName) {
    return false
  }

  // TODO: убрать логи и может подумать как уменьшить проверки

  const specificHeading = fileCache.headings?.find(h => h.heading === headingName);
  if (!specificHeading) {
    return false
  }
  // console.log('specificHeading:', specificHeading);

  const nextHeading = fileCache.headings?.find(h => h.position.start.line > specificHeading.position.end.line)
  // console.log('nextHeading:', nextHeading);

  const lastSection = fileCache.sections?.findLast(s => s.position.start.line > specificHeading.position.end.line)
  // console.log('lastSection', lastSection)

  if (!lastSection) {
    // there is no any sections after specific heading
    return false
  }

  const specificSectionLimit = nextHeading?.position.start.line ?? lastSection?.position.start.line;

  const isAnySectionInSpecificHeading = fileCache.sections?.some(s => s.type !== 'heading' && s.position.start.line > specificHeading.position.end.line && s.position.start.line <= specificSectionLimit) ?? false

  // console.log('sectionInDesiredHeading', isAnySectionInSpecificHeading);

  return isAnySectionInSpecificHeading;
}

export async function getDotsForDailyNote(
  dailyNote: TFile | null
): Promise<IDot[]> {
  if (!dailyNote) {
    return [];
  }
  const numSolidDots = await getWordLengthAsDots(dailyNote);

  const dots = [];
  for (let i = 0; i < numSolidDots; i++) {
    dots.push({
      color: "default",
      isFilled: true,
    });
  }

  const metadataCache = await globalThis.app.metadataCache.getFileCache(dailyNote);

  //TODO: get heading value from settings
  const noteHasContentInSpecifiedHeading = await isSpecifiedHeadingSectionHasContent(metadataCache, 'мысли')
  if (noteHasContentInSpecifiedHeading) {
    dots.unshift({
      className: "thought",
    })
  }

  //TODO: get tag value from settings
  const noteHasSpecifiedTag = await isNoteHasSpecifiedTag(metadataCache, '#идея')

  if (noteHasSpecifiedTag) {
    dots.unshift({
      className: "idea",
    })
  }

  return dots;
}

export const wordCountSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getDailyNote(date, get(dailyNotes));
    const dots = await getDotsForDailyNote(file);
    return {
      dots,
    };
  },

  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getWeeklyNote(date, get(weeklyNotes));
    const dots = await getDotsForDailyNote(file);

    return {
      dots,
    };
  },
};
