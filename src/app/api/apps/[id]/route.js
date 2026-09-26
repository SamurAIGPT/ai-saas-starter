import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization";

export async function GET(req, { params }) {
  try {
    const app = await prisma.app.findUnique({
      where: { id: params.id },
      include: { category: true },
    });

    if (!app || !app.isPublic) {
      return Response.json({ error: "App not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: app });
  } catch (error) {
    console.error("Error fetching app:", error);
    return Response.json({ error: "Failed to fetch app" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { response: denied } = await requireAdmin();
    if (denied) return denied;
    const body = await req.json();

    const app = await prisma.app.update({
      where: { id: params.id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        longDescription: body.longDescription,
        icon: body.icon,
        author: body.author,
        version: body.version,
        categoryId: body.categoryId,
        creditCost: body.creditCost,
        rating: body.rating,
        downloads: body.downloads,
        isPublic: body.isPublic,
        featured: body.featured,
        tags: body.tags,
      },
      include: { category: true },
    });

    return Response.json({ success: true, data: app });
  } catch (error) {
    console.error("Error updating app:", error);
    return Response.json({ error: "Failed to update app" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { response: denied } = await requireAdmin();
    if (denied) return denied;
    await prisma.app.delete({
      where: { id: params.id },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting app:", error);
    return Response.json({ error: "Failed to delete app" }, { status: 500 });
  }
}
