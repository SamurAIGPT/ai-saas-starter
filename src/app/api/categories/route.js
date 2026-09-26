import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization";

export async function GET(req) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: "asc" },
    });

    return Response.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return Response.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const { response: denied } = await requireAdmin();
    if (denied) return denied;
    const body = await req.json();

    const category = await prisma.category.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        icon: body.icon,
        color: body.color,
        order: body.order || 0,
      },
    });

    return Response.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return Response.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    );
  }
}
