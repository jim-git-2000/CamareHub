import { PlaceholderPage } from "@/components/placeholder-page";

type ItemDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { id } = await params;

  return <PlaceholderPage title={`Item ${id}`} description="Item detail placeholder." />;
}
