import { RoleTabs } from '@/components/layout/RoleTabs';

/** Abas do profissional: início, agenda, ganhos, mensagens e perfil. */
export default function CaregiverTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Início', icon: 'home-outline', iconActive: 'home' },
        { name: 'agenda', title: 'Agenda', icon: 'calendar-outline', iconActive: 'calendar' },
        { name: 'earnings', title: 'Ganhos', icon: 'wallet-outline', iconActive: 'wallet' },
        { name: 'messages', title: 'Mensagens', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
        { name: 'profile', title: 'Perfil', icon: 'person-outline', iconActive: 'person' },
      ]}
    />
  );
}
