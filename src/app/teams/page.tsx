import type { Metadata } from "next";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";

const TEAM_MEMBERS = [
  {
    name: "Placeholder 1",
    role: "Position 1",
    position: "Aiia",
  },
  {
    name: "Placeholder 2",
    role: "Position 2",
    position: "Aiia",
  },
  {
    name: "Placeholder 3",
    role: "Position 3",
    position: "Aiia",
  },
  {
    name: "Placeholder 4",
    role: "Position 4",
    position: "Aiia",
  },
  {
    name: "Placeholder 5",
    role: "Position 5",
    position: "Aiia",
  },
];

export const metadata: Metadata = {
  title: "Team — Kuwana",
  description:
    "kuwana.ai proudly brought to you by Aiia",
};

export default function TeamPage() {
  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />

      <h1 className="mt-4 font-display text-[24px] font-bold">Team</h1>
      <p className="text-[13px] text-text-secondary">kuwana.ai proudly brought to you by Aiia</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {TEAM_MEMBERS.map((member) => (
          <div
            key={member.name}
            className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 flex flex-col items-center gap-3"
          >
            <div className="h-16 w-16 rounded-full bg-accent-sky/10 text-accent-sky flex items-center justify-center">
              <div className="text-[20px] font-semibold">{member.name.charAt(0)}</div>
            </div>
            <h3 className="font-display text-[16px] font-semibold">{member.name}</h3>
            <p className="text-[12px] text-text-secondary">{member.role}</p>
            <p className="text-[11px] text-text-muted">{member.position}</p>
          </div>
        ))}
      </div>

      <BottomTabBar />
    </div>
  );
}