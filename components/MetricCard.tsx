interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'amber' | 'rose';
}

const accentMap = {
  blue:  'bg-blue-50  border-blue-200  text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  rose:  'bg-rose-50  border-rose-200  text-rose-700',
};

export default function MetricCard({ label, value, sub, accent = 'blue' }: MetricCardProps) {
  return (
    <div className={`border rounded-xl p-4 ${accentMap[accent]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}
