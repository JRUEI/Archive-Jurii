import { Globe, ShoppingBag } from 'lucide-react';
import type { OfficialLink, OfficialLinkIcon } from '@/lib/members';
import { InstagramIcon, TikTokIcon, XIcon, YouTubeIcon } from '@/components/BrandIcons';

const ICONS: Record<OfficialLinkIcon, (props: { size?: number }) => React.ReactElement> = {
  site: ({ size = 16 }) => <Globe size={size} />,
  youtube: YouTubeIcon,
  x: XIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  shop: ({ size = 16 }) => <ShoppingBag size={size} />,
};

const BASE_CLASS =
  'group h-10 inline-flex items-center justify-center px-3 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-brand-cream hover:bg-brand-brown hover:border-brand-brown dark:hover:text-[#2E2118] dark:hover:bg-brand-tan dark:hover:border-brand-tan transition-colors';

export default function OfficialLinks({ links }: { links: OfficialLink[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {links.map((link) => {
        const Icon = ICONS[link.icon];
        return (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`≒JOY ${link.label}`}
            aria-label={`≒JOY ${link.label}`}
            className={BASE_CLASS}
          >
            <Icon size={16} />
            {/* 平時只有 icon，滑過才把標題擐開 */}
            <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] transition-[grid-template-columns] duration-300 ease-out">
              <span className="overflow-hidden whitespace-nowrap text-sm font-medium tracking-wide">
                <span className="block pl-1.5">{link.label}</span>
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
