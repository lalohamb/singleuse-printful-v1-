import SettingsSectionClient from "../SettingsSectionClient";

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <SettingsSectionClient section={section} />;
}
