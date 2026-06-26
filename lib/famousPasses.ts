import { FamousPass } from '@/types';

export const FAMOUS_PASSES: FamousPass[] = [
  {
    id: 'starlink-train-bangalore-2023',
    title: 'Starlink Train — Bangalore, March 2023',
    lat: 12.9716,
    lon: 77.5946,
    timestamp: Date.UTC(2023, 2, 4, 19, 30),
    description:
      'Dozens of newly launched Starlink satellites crossed the sky in a tight, glowing line. Observers across Bangalore mistook the procession for a UFO formation before astronomers confirmed the source.',
  },
  {
    id: 'iss-solar-transit-mumbai-2024',
    title: 'ISS Solar Transit — Mumbai, January 2024',
    lat: 19.076,
    lon: 72.8777,
    timestamp: Date.UTC(2024, 0, 12, 6, 45),
    description:
      'For a fraction of a second, the ISS silhouette raced directly across the face of the Sun as seen from Mumbai. Solar-filtered telescopes caught the rare alignment in stunning detail.',
  },
  {
    id: 'mars-opposition-delhi-2022',
    title: 'Mars Opposition — Delhi, December 2022',
    lat: 28.6139,
    lon: 77.209,
    timestamp: Date.UTC(2022, 11, 8, 20, 0),
    description:
      'Mars reached opposition, rising in the east as the Sun set and shining brighter and larger than at almost any other point in its orbital cycle. Delhi skywatchers got an unusually clear view.',
  },
  {
    id: 'iss-lunar-silhouette-chennai-2023',
    title: 'ISS Lunar Silhouette — Chennai, August 2023',
    lat: 13.0827,
    lon: 80.2707,
    timestamp: Date.UTC(2023, 7, 19, 21, 10),
    description:
      "During the same week as the Chandrayaan-3 landing, the ISS crossed in front of the Moon's disk over Chennai — a brief silhouette that photographers had been tracking for days to capture.",
  },
  {
    id: 'venus-max-brightness-kolkata-2023',
    title: 'Venus at Maximum Brightness — Kolkata, July 2023',
    lat: 22.5726,
    lon: 88.3639,
    timestamp: Date.UTC(2023, 6, 7, 19, 45),
    description:
      'Venus hit its greatest illuminated extent for the year, blazing as the unmistakable "evening star" low over Kolkata\'s western horizon shortly after sunset.',
  },
];

export function getFamousPassById(id: string): FamousPass | undefined {
  return FAMOUS_PASSES.find((p) => p.id === id);
}
