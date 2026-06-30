import { BarChart3, Dumbbell, History, Home, Settings } from "lucide-react";

export const navigationItems = [
  { label: "首页", href: "/", icon: Home },
  { label: "打卡", href: "/records", icon: Dumbbell },
  { label: "数据", href: "/data", icon: BarChart3 },
  { label: "历史", href: "/history", icon: History },
  { label: "设置", href: "/settings", icon: Settings },
] as const;
