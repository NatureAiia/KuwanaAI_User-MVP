import Image from "next/image";
import Link from "next/link";
import { BackToTopButton } from "@/components/landing/BackToTopButton";

export function LandingFooter() {
  return (
    <footer className="border-t border-[#16212B] bg-[#0C161C] px-5 py-10 md:px-10">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8 md:flex-row md:justify-between">
        <div className="max-w-[36ch]">
          <div className="flex items-center gap-2">
            <Image src="/kuwana-mark.png" alt="" width={22} height={22} />
            <span className="font-display text-[15px] font-bold tracking-tight text-white">
              kuwana.ai
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-[1.6] text-[#7E8B97]">
            Explainable comparisons for the decisions that actually matter.
          </p>
        </div>

        <div className="flex gap-10">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#2DD4BF]">
              Product
            </h4>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[#9FB0BD]">
              <li>
                <Link href="/#features" className="hover:text-white">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-white">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/teams" className="hover:text-white">
                  Team
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#2DD4BF]">
              Account
            </h4>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[#9FB0BD]">
              <li>
                <Link href="/login" className="hover:text-white">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-white">
                  Get started
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#2DD4BF]">
              Trust
            </h4>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[#9FB0BD]">
              <li>
                <Link href="/trust" className="hover:text-white">
                  Our promises
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1120px] flex-col items-center gap-4 text-center">
        <p className="text-[12px] text-[#7E8B97]">
          <a href="https://kuwana.ai" className="hover:text-white">
            kuwana.ai
          </a>{" "}
          Proudly brought to you by Ai Institute Africa. Copyright 2026
        </p>
        <BackToTopButton />
      </div>
    </footer>
  );
}