import { Radio } from 'lucide-react';
import type { MemberSns } from '@/lib/members';
import { InstagramIcon, TikTokIcon, XIcon } from '@/components/BrandIcons';

const LINK_CLASS =
  'inline-flex items-center justify-center w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-brand-cream hover:bg-brand-brown hover:border-brand-brown dark:hover:text-brand-ink dark:hover:bg-brand-tan dark:hover:border-brand-tan transition-colors';

export default function MemberSnsLinks({ sns, name }: { sns: MemberSns; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <a href={sns.x} target="_blank" rel="noopener noreferrer" title={`${name} X`} aria-label={`${name} X`} className={LINK_CLASS}>
        <XIcon />
      </a>
      <a
        href={sns.instagram}
        target="_blank"
        rel="noopener noreferrer"
        title={`${name} Instagram`}
        aria-label={`${name} Instagram`}
        className={LINK_CLASS}
      >
        <InstagramIcon />
      </a>
      {sns.tiktok && (
        <a
          href={sns.tiktok}
          target="_blank"
          rel="noopener noreferrer"
          title={`${name} TikTok`}
          aria-label={`${name} TikTok`}
          className={LINK_CLASS}
        >
          <TikTokIcon />
        </a>
      )}
      <a
        href={sns.showroom}
        target="_blank"
        rel="noopener noreferrer"
        title={`${name} SHOWROOM`}
        aria-label={`${name} SHOWROOM`}
        className={LINK_CLASS}
      >
        <Radio size={14} />
      </a>
    </div>
  );
}
