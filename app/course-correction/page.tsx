import type { Metadata } from 'next';
import CourseCorrectionGame from '../../games/course-correction/Game';

export const metadata: Metadata = {
  title: 'Course Correction — Jumbleyard',
  description: 'Four-player mini-golf where every shot changes the hole.',
};

export default function CourseCorrectionPage() {
  return <CourseCorrectionGame />;
}
