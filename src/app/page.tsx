import { getAllEpisodeListItems } from '@/lib/markdown';
import HomeEpisodeList from '@/components/HomeEpisodeList';

export default function Home() {
  const episodes = getAllEpisodeListItems();

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 sm:py-8">
      <HomeEpisodeList episodes={episodes} />
    </div>
  );
}
