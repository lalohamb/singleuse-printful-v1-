import { Star } from 'lucide-react';

interface Props {
  quote: string;
  author: string;
  role: string;
}

export default function TestimonialCard({ quote, author, role }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 flex flex-col gap-5">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />)}
      </div>
      <p className="text-text-secondary leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>
      <div>
        <p className="font-semibold text-white">{author}</p>
        <p className="text-text-secondary text-sm">{role}</p>
      </div>
    </div>
  );
}
