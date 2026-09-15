import type { Metadata } from 'next';
import { Cake, Mic } from 'lucide-react';
import { getMembersData, getAge } from '@/lib/members';
import MemberSnsLinks from '@/components/MemberSnsLinks';
import OfficialLinks from '@/components/OfficialLinks';

export const metadata: Metadata = {
  title: '≒JOY 成員介紹 — 逢田珠里依｜SHOWROOM',
  description: '≒JOY（ニアリーイコールジョイ）12 位成員的漢字名、讀音、暱稱、中文譯名與生日，以及團體和各成員的官方網站、X、Instagram、TikTok、SHOWROOM 連結。',
};

function formatBirthday(birthday: string) {
  const [, month, day] = birthday.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function formatDebut(debut: string) {
  const [year, month] = debut.split('-');
  return `${year} 年 ${Number(month)} 月`;
}

export default function MembersPage() {
  const { group, sources, members } = getMembersData();
  const buildYear = new Date().getFullYear();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <header className="mb-10 sm:mb-14 text-center">
        <div className="inline-flex items-center px-4 py-1.5 mb-4 rounded-full bg-brand-yellow/10 dark:bg-brand-yellow/15 text-brand-ochre dark:text-brand-yellow text-xs sm:text-sm font-bold tracking-[0.2em]">
          {group.reading}
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-brown">
            {group.name}
          </span>
          <span className="ml-3">成員介紹</span>
        </h1>
        <div className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto space-y-1.5 [text-wrap:balance]">
          <p>
            {group.producer}製作，繼 {group.siblings.join('、')} 之後的第三組同門團體，
            通稱「{group.alias}」。
          </p>
          <p>
            {formatDebut(group.revealed)}公開 {members.length} 位成員，
            {formatDebut(group.debut)}以迷你專輯《{group.debutWork}》出道。
          </p>
          <p>
            直播裡大家多半互叫暱稱，這頁整理每位成員的本名、讀音、中文譯名與官方帳號。
          </p>
        </div>
        <div className="mt-6">
          <OfficialLinks links={group.links} />
        </div>
      </header>

      {/* 成員表：桌機表格 */}
      <section className="mb-12">
        {/* 標題跟人數字級不同，文字走 baseline，色條另外置中 */}
        <h2 className="text-xl font-bold mb-4 flex items-baseline gap-2">
          <span className="w-1 h-5 bg-brand-yellow rounded-full self-center" />
          成員一覽
          <span className="text-sm font-medium text-zinc-400">{members.length} 名</span>
        </h2>

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-yellow/8 dark:bg-zinc-950/60 text-left">
                <th className="px-4 py-3 font-bold whitespace-nowrap">漢字名</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">讀音</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">暱稱</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">中文譯名</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">生日</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">官方連結</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.name}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-brand-yellow/5 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-bold whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {member.name}
                      {member.isHost && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-[#2E2118] text-[11px] font-bold">
                          <Mic size={11} />
                          本站主角
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{member.kana}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{member.nicknames.join('、')}</td>
                  <td className="px-4 py-3 font-bold text-brand-ochre dark:text-brand-yellow whitespace-nowrap">
                    {member.zh}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {formatBirthday(member.birthday)}
                    <span className="text-zinc-400 dark:text-zinc-600 ml-1.5">
                      {getAge(member.birthday)} 歲
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <MemberSnsLinks sns={member.sns} name={member.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 成員表：手機卡片 */}
        <div className="md:hidden flex flex-col gap-3">
          {members.map((member) => (
            <div
              key={member.name}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-bold text-base flex items-center gap-1.5 flex-wrap">
                    {member.name}
                    {member.isHost && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-brown text-brand-cream dark:bg-brand-tan dark:text-[#2E2118] text-[11px] font-bold">
                        <Mic size={11} />
                        本站主角
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{member.kana}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-brand-ochre dark:text-brand-yellow font-bold">{member.zh}</div>
                  {/* 用區塊 flex 靠右，inline-flex 會吃到外層 16px 字的行高，比左邊讀音那行低 3px */}
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-end gap-1 mt-0.5">
                    <Cake size={12} />
                    {formatBirthday(member.birthday)}
                  </div>
                </div>
              </div>
              <div className="text-sm mb-3">
                <span className="text-zinc-400 dark:text-zinc-500">暱稱　</span>
                {member.nicknames.join('、')}
              </div>
              <MemberSnsLinks sns={member.sns} name={member.name} />
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-3">
          年齡以網站建置時間（{buildYear} 年）計算。官方連結依序為 X、Instagram、TikTok、SHOWROOM，取自官方 PROFILE 頁。
        </p>
      </section>

      {/* 出處 */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 mb-3 tracking-wider">資料來源</h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {[{ label: `${group.name} 官方網站`, url: group.officialUrl }, ...sources]
            .filter((source, index, list) => list.findIndex((item) => item.url === source.url) === index)
            .map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 dark:text-zinc-400 hover:text-brand-yellow dark:hover:text-brand-yellow underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700 transition-colors"
                >
                  {source.label}
                </a>
              </li>
            ))}
        </ul>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-4">
          本頁為非官方粉絲整理，內容與 {group.name} 官方及所屬事務所無關。
        </p>
      </section>
    </div>
  );
}
