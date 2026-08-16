import { ThemeCluster } from "@/lib/types";

export default function ThemeClusters({ themes }: { themes: ThemeCluster[] }) {
  if (themes.length === 0) return null;

  return (
    <div className="themes">
      {themes.map((theme) => (
        <span className="theme-badge" key={theme.theme}>
          {theme.theme} <b>{theme.count}</b>
        </span>
      ))}
    </div>
  );
}
