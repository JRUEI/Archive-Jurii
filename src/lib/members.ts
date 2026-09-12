import 'server-only';

import fs from 'fs';
import path from 'path';

const membersPath = path.join(process.cwd(), 'content', 'members.json');
const glossaryPath = path.join(process.cwd(), 'content', 'glossary.json');

export interface MemberSns {
  x: string;
  instagram: string;
  tiktok?: string;
  showroom: string;
}

export interface Member {
  name: string;
  kana: string;
  romaji: string;
  zh: string;
  nicknames: string[];
  asr: string[];
  birthday: string;
  isHost: boolean;
  note: string;
  sns: MemberSns;
}

export type OfficialLinkIcon = 'site' | 'youtube' | 'x' | 'instagram' | 'tiktok' | 'shop';

export interface OfficialLink {
  label: string;
  url: string;
  icon: OfficialLinkIcon;
}

export interface GroupInfo {
  name: string;
  reading: string;
  alias: string;
  producer: string;
  revealed: string;
  debut: string;
  debutWork: string;
  siblings: string[];
  officialUrl: string;
  links: OfficialLink[];
}

export interface SourceLink {
  label: string;
  url: string;
}

export interface MembersData {
  group: GroupInfo;
  rules: string[];
  sources: SourceLink[];
  members: Member[];
}

export interface GlossaryRule {
  scope: string;
  source: string;
  replacement: string;
}

export function getMembersData(): MembersData {
  const data = JSON.parse(fs.readFileSync(membersPath, 'utf8')) as MembersData;
  // 依生日排序，讓表格順序穩定（年長者在前）
  data.members = [...data.members].sort((a, b) => a.birthday.localeCompare(b.birthday));
  return data;
}

// 詞語庫直接讀 content/glossary.json，頁面不需要重複維護一份。
export function getGlossaryRules(): GlossaryRule[] {
  const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8')) as {
    global?: Record<string, string>;
    episodes?: Record<string, Record<string, string>>;
  };

  const rules: GlossaryRule[] = Object.entries(glossary.global || {}).map(([source, replacement]) => ({
    scope: '全集通用',
    source,
    replacement,
  }));

  for (const [episode, episodeRules] of Object.entries(glossary.episodes || {})) {
    for (const [source, replacement] of Object.entries(episodeRules || {})) {
      rules.push({ scope: `第 ${episode} 集限定`, source, replacement });
    }
  }

  return rules;
}

export function getAge(birthday: string, today = new Date()): number | null {
  const born = new Date(birthday);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const hasHadBirthday =
    today.getMonth() > born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
}
