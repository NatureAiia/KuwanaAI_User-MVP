import Image from "next/image";

export function AdminFooter() {
  return (
    <footer className="mt-auto flex justify-end px-5 py-6 md:px-10">
      <div className="flex items-center gap-2">
        <Image src="/kuwana-mark.png" alt="" width={18} height={18} className="rounded-full" />
        <span className="font-display text-[12px] font-semibold text-text-muted">kuwana.ai</span>
      </div>
    </footer>
  );
}
