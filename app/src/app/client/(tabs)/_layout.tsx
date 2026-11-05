import { RoleTabs } from '@/components/layout/RoleTabs';

/** Abas do cliente: início, busca, agenda, mensagens e perfil. */
export default function ClientTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Início', icon: 'home-outline', iconActive: 'home' },
        { name: 'search', title: 'Buscar', icon: 'search-outline', iconActive: 'search' },
        { name: 'agenda', title: 'Agenda', icon: 'calendar-outline', iconActive: 'calendar' },
        { name: 'messages', title: 'Mensagens', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
        { name: 'profile', title: 'Perfil', icon: 'person-outline', iconActive: 'person' },
      ]}
    />
  );
}
