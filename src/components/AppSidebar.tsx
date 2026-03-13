import {
  LayoutDashboard,
  Server,
  ClipboardCheck,
  Archive,
  AlertTriangle,
  BarChart3,
  ScrollText,
  Shield,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
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

const mainNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'System Profiles', url: '/systems', icon: Server },
  { title: 'Review Cases', url: '/reviews', icon: ClipboardCheck },
  { title: 'Evidence Vault', url: '/evidence', icon: Archive },
  { title: 'Findings & Actions', url: '/findings', icon: AlertTriangle },
];

const reportsNav = [
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Audit Log', url: '/audit-log', icon: ScrollText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <Shield className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">GxP Review</span>
              <span className="text-[10px] text-sidebar-foreground/60">Periodic Review Manager</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === '/'}>
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
          <SidebarGroupLabel>Compliance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            QA
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-sidebar-foreground">QA Admin</span>
              <span className="text-[10px] text-sidebar-foreground/60">qa@pharma.com</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
