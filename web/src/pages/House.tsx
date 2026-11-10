import { Link } from 'react-router-dom';
import { Skeleton } from '../components/ui';
import { useApp, useFetch } from '../store';
import type { Summary } from '../types';
import { HouseSplitCard, HousingCard } from './Dashboard';

export default function House() {
  const { month } = useApp();
  const { data } = useFetch<Summary>(`/summary?month=${month}`);
  if (!data) return <Skeleton h={400} />;
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        <HouseSplitCard s={data} />
        <HousingCard s={data} />
      </div>
      <p className="sub" style={{ textAlign: 'center' }}>
        Edite as contas em <Link to="/contas-casa" style={{ color: 'var(--primary)' }}>Contas da casa</Link> e a divisão em{' '}
        <Link to="/renda" style={{ color: 'var(--primary)' }}>Nossa renda</Link>.
      </p>
    </>
  );
}
