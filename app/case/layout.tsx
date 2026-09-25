import { StepRail } from "@/components/StepRail";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-0 xl:flex-row xl:gap-10 px-4 pb-16 pt-8 md:px-12 md:pt-10">
      <StepRail />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
