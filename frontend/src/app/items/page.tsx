import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function ItemsPage() {
  return (
    <PlaceholderPage title="Items" description="Gear list placeholder.">
      <Button asChild>
        <Link href="/items/new">New item</Link>
      </Button>
    </PlaceholderPage>
  );
}
