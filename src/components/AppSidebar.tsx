import {
  LayoutDashboard,
  Server,
  ClipboardCheck,
  Archive,
  AlertTriangle,
  BarChart3,
  ScrollText,
  Users,
  LogOut,
} from 'lucide-react';
const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images/ValiTrack_Logo_small.png`;
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile, roles, signOut, isSuperUser } = useAuth();

  const mainNav = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { title: t('nav.systemProfiles'), url: '/systems', icon: Server },
    { title: t('nav.reviewCases'), url: '/reviews', icon: ClipboardCheck },
    { title: t('nav.evidenceVault'), url: '/evidence', icon: Archive },
    { title: t('nav.findingsActions'), url: '/findings', icon: AlertTriangle },
  ];

  const reportsNav = [
    { title: t('nav.reports'), url: '/reports', icon: BarChart3 },
    { title: t('nav.auditLog'), url: '/audit-log', icon: ScrollText },
  ];

  const isActive = (path: string) =>
    path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(path);

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const primaryRole = roles[0]
    ? roles[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : t('sidebar.noRole');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <img src={LOGO_URL} alt="ValiTrack" className="h-8 w-8 shrink-0 object-contain" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">{t('app.name')}</span>
              <span className="text-[10px] text-sidebar-foreground/60">{t('app.subtitle')}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.main')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.compliance')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportsNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperUser() && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>{t('nav.administration')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/admin/users')}
                      tooltip={t('nav.userManagement')}
                    >
                      <NavLink to="/admin/users">
                        <Users className="h-4 w-4" />
                        {!collapsed && <span>{t('nav.userManagement')}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                {profile?.full_name || t('sidebar.loading')}
              </span>
              <span className="truncate text-[10px] text-sidebar-foreground/60">
                {primaryRole}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={signOut}
              className="shrink-0 rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title={t('sidebar.signOut')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
