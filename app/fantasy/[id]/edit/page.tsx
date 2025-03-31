'use client';

import { useParams } from 'next/navigation';
import EditFantasyTeamClient from './EditFantasyTeamClient';

export default function Page() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id || '';
  
  return <EditFantasyTeamClient teamId={id} />;
} 