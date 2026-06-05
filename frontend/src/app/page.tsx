import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">CameraHub</h1>
        <p className="mt-2 text-muted-foreground">Unified layout and API client are ready.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Task 8</CardTitle>
          <CardDescription>Navigation, layout, and API health checks are initialized.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
