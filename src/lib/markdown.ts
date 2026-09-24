import 'server-only';

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const episodesDirectory = path.join(process.cwd(), 'content', 'episodes');

export type EpisodeSummary = string[];

export interface EpisodeCard {
  tag: string;
  title: string;
  /** 這一段開始的時間碼，mm:ss；超過一小時分鐘繼續往上數（[62:00]） */
  time?: string;
  /** 標題底下、條列之前的那一段白話，卡片上點開這一段時就顯示它 */
  brief?: string;
  content: string[];
}

export interface TranscriptLine {
  time: string;
  speaker: string;
  text: string;
}

export interface EpisodeData {
  id: string;
  title: string;
  date: string;
  episodeNumber: number;
  episodeLabel?: string;
  durationMinutes?: number;
  abstract?: string[];
  summary: EpisodeSummary;
  cards: EpisodeCard[];
  transcript?: TranscriptLine[];
  youtubeUrl?: string;
  guest?: string;
}

/** 首頁列表用的段落目錄，只留標籤與標題 */
export interface EpisodeSection {
  tag: string;
  title: string;
  brief?: string;
}

export interface EpisodeListItem {
  id: string;
  title: string;
  date: string;
  episodeNumber: number;
  episodeLabel?: string;
  durationMinutes?: number;
  sections: EpisodeSection[];
  lineCount: number;
  guest?: string;
  youtubeUrl?: string;
}

function getEpisodeFileNames() {
  if (!fs.existsSync(episodesDirectory)) return [];
  return fs.readdirSync(episodesDirectory).filter((fileName) => fileName.endsWith('.md'));
}

export function getAllEpisodeIds() {
  return getEpisodeFileNames().map((fileName) => {
    return {
      params: {
        id: fileName.replace(/\.md$/, ''),
      },
    };
  });
}

export function getEpisodeData(id: string): EpisodeData | null {
  const fullPath = path.join(episodesDirectory, `${id}.md`);
  if (!fs.existsSync(fullPath)) return null;
  const fileContents = fs.readFileSync(fullPath, 'utf8');

  // Use gray-matter to parse the post metadata section
  const matterResult = matter(fileContents);
  
  // Parse Content
  const content = matterResult.content;
  
  // Extract Summary
  const summaryMatch = content.match(/##\s*【精簡總結】([\s\S]*?)(?=\n##\s*【|$)/);
  if (!summaryMatch) {
    console.warn(`[markdown] Episode "${id}": Could not find 【精簡總結】 section. Check Markdown formatting.`);
  }
  const summaryText = summaryMatch ? summaryMatch[1] : '';
  const summary = summaryText
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => line.replace(/^[\*\-]\s*/, '').trim());

  // Extract Cards (無損還原 or 段落紀錄)
  const cardsMatch = content.match(/##\s*【(?:無損還原|段落紀錄)】([\s\S]*?)(?=\n##\s*【|$)/);
  if (!cardsMatch) {
    console.warn(`[markdown] Episode "${id}": Could not find 【無損還原 / 段落紀錄】 section. Check Markdown formatting.`);
  }
  const cardsText = cardsMatch ? cardsMatch[1] : '';
  
  const cardSections = cardsText.split('### ').map(s => s.trim()).filter(Boolean);
  const cards: EpisodeCard[] = cardSections.map(section => {
    const lines = section.split('\n');
    // 標題開頭的 [mm:ss] 是這一段在逐字稿裡開始的位置
    const timeMatch = lines[0].trim().match(/^\[(\d{1,3}:\d{2}(?::\d{2})?)\]\s*/);
    const headerLine = lines[0].trim().slice(timeMatch?.[0].length ?? 0);
    // Parse tag and title from "一般話題 1人的廣播，不一樣的節奏"
    // Assuming format is "[Tag] Title" separated by space
    const firstSpaceIndex = headerLine.indexOf(' ');
    let tag = '';
    let title = headerLine;
    
    if (headerLine.startsWith('[')) {
      const closingBracketIndex = headerLine.indexOf(']');
      if (closingBracketIndex !== -1) {
        tag = headerLine.substring(1, closingBracketIndex).trim();
        title = headerLine.substring(closingBracketIndex + 1).trim();
      }
    } else if (firstSpaceIndex !== -1) {
      tag = headerLine.substring(0, firstSpaceIndex).trim();
      title = headerLine.substring(firstSpaceIndex + 1).trim();
    }

    const bodyContent: string[] = [];
    let brief: string | undefined;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 條列還沒開始前的那一段白話就是這一段的簡述，不進條列
      if (brief === undefined && bodyContent.length === 0 && !/^[*\->]/.test(line)) {
        brief = line;
        continue;
      }

      if (line.startsWith('>')) {
        const quoteText = line.replace(/^>\s*/, '').replace(/^「/, '').replace(/」$/, '').trim();
        bodyContent.push(`QUOTE:${quoteText}`);
      } else {
        bodyContent.push(line);
      }
    }

    return { tag, title, time: timeMatch?.[1], brief, content: bodyContent };
  });

  // Extract Transcript
  const transcriptMatch = content.match(/##\s*【完整逐字稿】([\s\S]*)$/);
  const transcript: TranscriptLine[] = [];
    if (transcriptMatch) {
      const transcriptText = transcriptMatch[1];
      const lines = transcriptText.split('\n');
      const lineRegex = /^\[(\d{1,3}:\d{2}(?::\d{2})?)\]\s*\[(.*?)\]\s*(.*)$/;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(lineRegex);
        if (match) {
          transcript.push({
            time: match[1],
            speaker: match[2],
            text: match[3]
          });
        }
      }
    }

  // 直播長度＝逐字稿最後一筆時間碼，不另外在 front matter 維護
  const lastTime = transcript.length ? transcript[transcript.length - 1].time : '';
  const durationMinutes = lastTime
    ? (() => {
        const parts = lastTime.split(':').map(Number);
        const [h, m, sec] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
        return Math.round((h * 3600 + m * 60 + sec) / 60);
      })()
    : undefined;

  return {
    id,
    title: matterResult.data.title || '',
    date: typeof matterResult.data.date === 'string' 
      ? matterResult.data.date 
      : matterResult.data.date instanceof Date 
        ? matterResult.data.date.toISOString().split('T')[0]
        : '',
    episodeNumber: matterResult.data.episode || 0,
    episodeLabel: matterResult.data.episodeLabel || undefined,
    durationMinutes,
    abstract: Array.isArray(matterResult.data.abstract) ? matterResult.data.abstract : undefined,
    summary,
    cards,
    transcript,
    youtubeUrl: matterResult.data.youtube || undefined,
    guest: matterResult.data.guest || undefined
  };
}

export function getAllEpisodes(): EpisodeData[] {
  const allEpisodes = getEpisodeFileNames().map((fileName) => {
    const id = fileName.replace(/\.md$/, '');
    return getEpisodeData(id);
  }).filter(Boolean) as EpisodeData[];

  // Sort by broadcast date descending (ids are date-based, so earlier
  // episodes can be added later without renumbering anything)
  return allEpisodes.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.episodeNumber - a.episodeNumber;
  });
}

export function getAllEpisodeListItems(): EpisodeListItem[] {
  return getAllEpisodes().map((episode) => ({
    id: episode.id,
    title: episode.title,
    date: episode.date,
    episodeNumber: episode.episodeNumber,
    episodeLabel: episode.episodeLabel,
    durationMinutes: episode.durationMinutes,
    sections: episode.cards.map(({ tag, title, brief }) => ({ tag, title, brief })),
    lineCount: episode.transcript?.length ?? 0,
    guest: episode.guest,
    youtubeUrl: episode.youtubeUrl,
  }));
}
