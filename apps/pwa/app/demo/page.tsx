import { notFound } from 'next/navigation';
import DemoLab from '../_components/demo-lab';

const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_LAB === 'true' || process.env.NODE_ENV !== 'production';

export default function DemoPage() {
  if (!DEMO_ENABLED) {
    notFound();
  }

  return (
    <main>
      <DemoLab />
    </main>
  );
}
