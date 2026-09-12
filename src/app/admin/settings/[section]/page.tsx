import SettingsSectionClient from "../SettingsSectionClient";

export default async function SettingsSectionPage({ params }: { params: { section: string } }) {
  return <SettingsSectionClient section={params.section} />;
}
