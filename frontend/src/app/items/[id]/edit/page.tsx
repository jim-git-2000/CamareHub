import { PlaceholderPage } from "@/components/placeholder-page";

type EditItemPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditItemPage({ params }: EditItemPageProps) {
  const { id } = await params;

  return <PlaceholderPage title={`Edit item ${id}`} description="Edit item placeholder." />;
}
