import { requireCorporateProvider } from "@/lib/corporateAuth";
import { CompanyProfileForm } from "@/components/corporate/CompanyProfileForm";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";

export default async function CorporateProfilePage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Company Profile</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        This is your company&apos;s own profile — not a personal account profile. It&apos;s what
        shoppers see on every one of your listings.
      </p>
      <div className="mt-4">
        <CompanyProfileForm
          initialName={provider.name}
          initialLogoUrl={provider.logoUrl}
          initialDescription={provider.description}
        />
      </div>
    </div>
  );
}
